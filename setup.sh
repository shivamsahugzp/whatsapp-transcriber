#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — One-shot Oracle Cloud Free VM setup for WhatsApp Transcriber
# Run once as ubuntu user: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   WhatsApp Transcriber — Server Setup    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "▶ Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq git curl ffmpeg python3 python3-pip

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
echo "▶ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null
sudo apt-get install -y -qq nodejs

echo "   Node $(node -v) | npm $(npm -v)"

# ── 3. yt-dlp ────────────────────────────────────────────────────────────────
echo "▶ Installing yt-dlp..."
sudo curl -sSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
echo "   yt-dlp $(yt-dlp --version)"

# ── 4. PM2 ───────────────────────────────────────────────────────────────────
echo "▶ Installing PM2..."
sudo npm install -g pm2 --quiet
echo "   PM2 $(pm2 -v)"

# ── 5. Clone / pull repo ──────────────────────────────────────────────────────
REPO_DIR="$HOME/whatsapp-transcriber"

if [ -d "$REPO_DIR/.git" ]; then
  echo "▶ Pulling latest code..."
  git -C "$REPO_DIR" pull
else
  echo "▶ Cloning repository..."
  git clone https://github.com/shivamsahugzp/whatsapp-transcriber.git "$REPO_DIR"
fi

# ── 6. npm install ────────────────────────────────────────────────────────────
echo "▶ Installing npm dependencies..."
cd "$REPO_DIR"
npm install --omit=dev --silent

# ── 7. .env setup ─────────────────────────────────────────────────────────────
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo ""
  echo "  ┌────────────────────────────────────────────────┐"
  echo "  │  ACTION REQUIRED: Add your Sarvam API key      │"
  echo "  │  Run: nano $REPO_DIR/.env     │"
  echo "  └────────────────────────────────────────────────┘"
  echo ""
fi

# ── 8. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "   1. Add your Sarvam API key:"
echo "      nano $REPO_DIR/.env"
echo ""
echo "   2. First run — scan QR code to link WhatsApp:"
echo "      cd $REPO_DIR && node src/index.js"
echo ""
echo "   3. After QR scan succeeds (bot says ✅ connected), Ctrl+C and run:"
echo "      cd $REPO_DIR && pm2 start ecosystem.config.js"
echo "      pm2 save"
echo "      pm2 startup   ← run the command it prints (starts on VM reboot)"
echo ""
echo "   4. Check logs anytime:"
echo "      pm2 logs wa-transcriber"
echo ""
