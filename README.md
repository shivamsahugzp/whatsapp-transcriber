# WhatsApp Transcriber Bot

A WhatsApp bot that transcribes YouTube, Instagram, and Facebook videos into Hindi, English, or Hinglish text. Send the bot a video link in any WhatsApp chat — it replies with the transcript in 10–20 seconds.

Built so my parents, who don't speak English fluently, can read transcripts of forwarded reels and YouTube clips in a language they're comfortable with.

## How it works

```
WhatsApp message  →  link extractor  →  yt-dlp (download audio)
                                          ↓
                                       Sarvam AI Saaras v3
                                       (auto-detects Hindi / English / Hinglish)
                                          ↓
                                       formatted transcript
                                          ↓
                              reply in same WhatsApp thread
```

- **WhatsApp transport:** [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) — connects as a linked device, no Business API approval needed.
- **Audio extraction:** `yt-dlp` with a 50 MB ceiling and 90s download timeout.
- **Transcription:** [Sarvam AI Saaras v3](https://www.sarvam.ai/) — Indic-language speech model. Auto-detects which language the audio is in.
- **Deploy target:** Oracle Cloud free-tier VM (always-on, never restarted). PM2 keeps it alive.

## Why these choices

| Constraint | Decision |
|---|---|
| Free, always-on host | Oracle Cloud Always Free VM |
| No paid WhatsApp API | Baileys (works with personal WhatsApp number) |
| Indian-language transcription | Sarvam (Hindi/Hinglish quality > Whisper on this data) |
| Tiny memory footprint | History sync disabled, silent Pino logger |

## Setup

```bash
git clone https://github.com/shivamsahugzp/whatsapp-transcriber
cd whatsapp-transcriber
cp .env.example .env       # add your SARVAM_API_KEY
npm install
bash setup.sh              # installs yt-dlp + ffmpeg if missing
npm start
```

On first run, scan the QR code shown in the terminal from WhatsApp → Linked Devices. Credentials persist in `auth/` — re-link not needed unless you log out.

## Supported link sources

- YouTube (Shorts and regular videos)
- Instagram (Reels and posts with video)
- Facebook (public videos)

Private / age-restricted / login-walled videos fail gracefully with a user-readable error.

## Files

```
src/index.js        WhatsApp connection + message loop + error mapping
src/downloader.js   yt-dlp wrapper; cleans up temp files
src/transcriber.js  Sarvam API client; multipart upload
src/utils.js        URL extraction + transcript chunking (>4k char messages)
ecosystem.config.js PM2 process config
setup.sh            One-shot dep install (yt-dlp, ffmpeg)
```

## Notes

- Built with [Claude](https://claude.com) as pair-programmer.
- MIT licensed. Personal-use project.
- Not affiliated with WhatsApp, Sarvam AI, or the linked video platforms.
