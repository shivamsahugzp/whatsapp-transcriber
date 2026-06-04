'use strict';

const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const TEMP_DIR = path.join(os.tmpdir(), 'wa-transcriber');
const DOWNLOAD_TIMEOUT_MS = 90_000; // 90s — more than enough for 60s videos

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Downloads audio from a video URL using yt-dlp.
 * Returns the path to the downloaded mp3 file.
 */
async function downloadAudio(url) {
  ensureTempDir();

  const basename  = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const template  = path.join(TEMP_DIR, `${basename}.%(ext)s`);

  await runYtDlp(url, template);

  // yt-dlp writes the extension it chose — find the file
  const file = findOutputFile(TEMP_DIR, basename);
  if (!file) throw new Error('Download failed: output file not found');

  return file;
}

function runYtDlp(url, outputTemplate) {
  const args = [
    '--extract-audio',
    '--audio-format',   'mp3',
    '--audio-quality',  '5',          // VBR ~128kbps — fine for speech
    '--no-playlist',
    '--max-filesize',   '50m',        // 60s video ≈ 1-2MB in mp3; 50m is a safe ceiling
    '--output',         outputTemplate,
    '--no-warnings',
    '--quiet',
    '--no-progress',
    // Cookies/auth not needed for public videos
    url,
  ];

  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: DOWNLOAD_TIMEOUT_MS }, (err, _stdout, stderr) => {
      if (!err) return resolve();

      // Map common yt-dlp errors to readable messages
      const msg = stderr || err.message || '';
      if (msg.includes('Private video'))       return reject(new Error('PRIVATE_VIDEO'));
      if (msg.includes('not available'))       return reject(new Error('VIDEO_UNAVAILABLE'));
      if (msg.includes('no formats'))          return reject(new Error('NO_FORMATS'));
      if (err.killed || msg.includes('killed')) return reject(new Error('TIMEOUT'));
      reject(new Error(`Download failed: ${msg.slice(0, 200)}`));
    });
  });
}

function findOutputFile(dir, basename) {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(basename));
    return files.length > 0 ? path.join(dir, files[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Deletes a file silently — always call this after transcription.
 */
function cleanup(filePath) {
  if (!filePath) return;
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

module.exports = { downloadAudio, cleanup };
