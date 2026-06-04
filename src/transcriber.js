'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { cleanup } = require('./downloader');

const SARVAM_URL = 'https://api.sarvam.ai/speech-to-text';
const TIMEOUT_MS = 60_000;

/**
 * Sends audio to Sarvam AI Saaras v3 and returns { text, language }.
 * Always cleans up the audio file — even on error.
 */
async function transcribe(audioPath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
    });
    form.append('model', 'saaras:v3');
    form.append('language_code', 'unknown');   // auto-detect: Hindi / English / Hinglish
    form.append('with_timestamps', 'false');

    const response = await axios.post(SARVAM_URL, form, {
      headers: {
        ...form.getHeaders(),
        'api-subscription-key': process.env.SARVAM_API_KEY,
      },
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const { transcript, language_code } = response.data;

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Empty transcript — audio may be silent or too short');
    }

    return {
      text:     transcript.trim(),
      language: language_code || 'unknown',
    };

  } catch (err) {
    // Re-throw with a clean message
    if (err.response) {
      const status = err.response.status;
      const detail = err.response.data?.message || err.response.data || '';
      if (status === 401) throw new Error('INVALID_API_KEY');
      if (status === 429) throw new Error('RATE_LIMITED');
      if (status === 413) throw new Error('FILE_TOO_LARGE');
      throw new Error(`Sarvam API error ${status}: ${detail}`);
    }
    if (err.code === 'ECONNABORTED') throw new Error('TRANSCRIPTION_TIMEOUT');
    throw err;

  } finally {
    cleanup(audioPath);
  }
}

module.exports = { transcribe };
