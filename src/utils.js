'use strict';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const SUPPORTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.watch',
  'twitter.com',
  'x.com',
  'tiktok.com',
];

const LANG_LABELS = {
  'hi-IN':  'Hindi',
  'en-IN':  'English',
  'en-US':  'English',
  'bn-IN':  'Bengali',
  'ta-IN':  'Tamil',
  'te-IN':  'Telugu',
  'mr-IN':  'Marathi',
  'gu-IN':  'Gujarati',
  'kn-IN':  'Kannada',
  'pa-IN':  'Punjabi',
  'ml-IN':  'Malayalam',
  'or-IN':  'Odia',
  'unknown': 'Auto',
};

/**
 * Extracts the first URL from a message string.
 */
function extractUrl(text) {
  const matches = text.match(URL_REGEX);
  return matches ? matches[0].trim() : null;
}

/**
 * Returns true if the URL belongs to a supported video platform.
 */
function isSupportedUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return SUPPORTED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Returns the platform name from a URL for display purposes.
 */
function getPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube';
    if (hostname.includes('instagram')) return 'Instagram';
    if (hostname.includes('facebook') || hostname.includes('fb.')) return 'Facebook';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter/X';
    if (hostname.includes('tiktok')) return 'TikTok';
    return 'Video';
  } catch {
    return 'Video';
  }
}

/**
 * Formats the transcript for sending back on WhatsApp.
 * Splits into chunks if it somehow exceeds WhatsApp's limit (unlikely for 30-60s videos).
 */
function formatTranscript(text, detectedLanguage, url) {
  const lang = LANG_LABELS[detectedLanguage] || detectedLanguage || 'Auto';
  const platform = getPlatform(url);
  const header = `📝 *${platform} Transcript* [${lang}]\n\n`;
  const full = header + text;

  // WhatsApp max message length is 65,536 chars
  const MAX = 65000;
  if (full.length <= MAX) return [full];

  // Split into chunks preserving header on first chunk only
  const chunks = [];
  let remaining = text;
  let isFirst = true;

  while (remaining.length > 0) {
    const prefix = isFirst ? header : `📝 *(continued)*\n\n`;
    const available = MAX - prefix.length;
    chunks.push(prefix + remaining.slice(0, available));
    remaining = remaining.slice(available);
    isFirst = false;
  }

  return chunks;
}

module.exports = { extractUrl, isSupportedUrl, formatTranscript };
