'use strict';

require('dotenv').config();

const path  = require('path');
const pino  = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const { downloadAudio }                 = require('./downloader');
const { transcribe }                    = require('./transcriber');
const { extractUrl, isSupportedUrl, formatTranscript } = require('./utils');

// ─── Config ──────────────────────────────────────────────────────────────────

const AUTH_DIR  = path.join(__dirname, '..', 'auth');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

if (!process.env.SARVAM_API_KEY) {
  console.error('❌  SARVAM_API_KEY is not set in .env — exiting.');
  process.exit(1);
}

// ─── Logger (silent for Baileys internals, our own logs go to stdout) ────────

const logger = pino({ level: 'silent' });

// ─── Error message map ───────────────────────────────────────────────────────

const ERROR_MESSAGES = {
  PRIVATE_VIDEO:          '❌ This video is private — I can\'t access it.',
  VIDEO_UNAVAILABLE:      '❌ Video is unavailable or deleted.',
  NO_FORMATS:             '❌ Couldn\'t find a downloadable format for this video.',
  TIMEOUT:                '⏱️ Download timed out. The server might be slow — try again.',
  INVALID_API_KEY:        '❌ Transcription API key is invalid. Tell Shivam to check the .env file.',
  RATE_LIMITED:           '⏱️ Transcription API is rate-limited. Wait a moment and try again.',
  FILE_TOO_LARGE:         '❌ Audio file too large — this shouldn\'t happen for short videos.',
  TRANSCRIPTION_TIMEOUT:  '⏱️ Transcription timed out. Try again.',
};

function getUserFriendlyError(err) {
  return ERROR_MESSAGES[err.message] || `❌ Something went wrong: ${err.message.slice(0, 100)}`;
}

// ─── Message handler ─────────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
  if (msg.key.fromMe) return;
  if (!msg.message)   return;

  // Extract text from all common message types
  const text =
    msg.message.conversation                       ||
    msg.message.extendedTextMessage?.text          ||
    msg.message.imageMessage?.caption              ||
    msg.message.videoMessage?.caption              ||
    '';

  if (!text) return;

  const url = extractUrl(text);
  if (!url || !isSupportedUrl(url)) return;

  const jid = msg.key.remoteJid;

  console.log(`[${new Date().toISOString()}] Processing: ${url}`);

  // Acknowledge immediately so the user knows we got it
  await sock.sendMessage(jid, {
    text: '⏳ Downloading & transcribing... (usually takes 10-20 seconds)',
  }, { quoted: msg });

  let audioPath = null;

  try {
    // Step 1: Download audio
    audioPath = await downloadAudio(url);
    console.log(`[download] OK → ${audioPath}`);

    // Step 2: Transcribe
    const { text: transcript, language } = await transcribe(audioPath);
    audioPath = null; // transcriber cleans up
    console.log(`[transcribe] OK — lang=${language}, chars=${transcript.length}`);

    // Step 3: Send result (handles long transcripts via chunking)
    const chunks = formatTranscript(transcript, language, url);
    for (const chunk of chunks) {
      await sock.sendMessage(jid, { text: chunk });
    }

  } catch (err) {
    console.error(`[error] ${err.message}`);
    // Cleanup if transcriber didn't get a chance to
    if (audioPath) {
      const { cleanup } = require('./downloader');
      cleanup(audioPath);
    }
    await sock.sendMessage(jid, { text: getUserFriendlyError(err) });
  }
}

// ─── Bot startup ─────────────────────────────────────────────────────────────

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version }          = await fetchLatestBaileysVersion();

  console.log(`Using Baileys v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth:               state,
    logger,
    printQRInTerminal:  true,      // Shows QR in terminal on first run
    browser:            ['Transcriber', 'Chrome', '120.0.0'],
    // Disable unnecessary features to keep memory low on Oracle free VM
    syncFullHistory:    false,
    markOnlineOnConnect: false,
  });

  // Persist credentials on every update
  sock.ev.on('creds.update', saveCreds);

  // Handle connection lifecycle
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan this QR code with WhatsApp → Linked Devices → Link a Device\n');
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp bot connected and ready!');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null;

      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.error('❌ Logged out from WhatsApp. Delete the auth/ folder and restart to re-link.');
        process.exit(1);
      }

      console.log(`Connection closed (code=${statusCode}). Reconnecting in 5s…`);
      setTimeout(startBot, 5000);
    }
  });

  // Process incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Fire and forget — errors are handled inside handleMessage
      handleMessage(sock, msg).catch((err) => {
        console.error('[unhandled]', err.message);
      });
    }
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

console.log('🚀 Starting WhatsApp Transcriber Bot…');
startBot().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
