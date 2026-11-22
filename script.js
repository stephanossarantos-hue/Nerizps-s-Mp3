'use strict';

// Frontend contract:
// POST JSON { sourceUrl } to your own authorized conversion API.
// Expected success JSON: { success: true, audioUrl: "https://...", fileName?: "...", mimeType?: "audio/mpeg" }
// The API must enforce rights/authorization and return a real MP3 URL.
// No client-side YouTube extraction or simulated success is performed.

const API_ENDPOINT = ''; // Example: '/api/convert' — configure your authorized backend.

const form = document.querySelector('#convertForm');
const urlInput = document.querySelector('#sourceUrl');
const clearButton = document.querySelector('#clearButton');
const convertButton = document.querySelector('#convertButton');
const errorMessage = document.querySelector('#errorMessage');
const loadingState = document.querySelector('#loadingState');
const loadingText = document.querySelector('#loadingText');
const homeScreen = document.querySelector('#homeScreen');
const resultsScreen = document.querySelector('#resultsScreen');
const audioPlayer = document.querySelector('#audioPlayer');
const downloadButton = document.querySelector('#downloadButton');
const exitButton = document.querySelector('#exitButton');

document.querySelector('#year').textContent = new Date().getFullYear();

function setError(message = '') {
  errorMessage.textContent = message;
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function setBusy(busy, message = 'Checking source…') {
  convertButton.disabled = busy;
  convertButton.querySelector('.button-label').textContent = busy ? 'Please wait…' : 'Convert to MP3';
  loadingText.textContent = message;
  loadingState.hidden = !busy;
}

function showHomeAndReset() {
  audioPlayer.pause();
  audioPlayer.removeAttribute('src');
  audioPlayer.load();
  downloadButton.removeAttribute('href');
  downloadButton.removeAttribute('download');
  urlInput.value = '';
  clearButton.hidden = true;
  setError('');
  setBusy(false);
  resultsScreen.hidden = true;
  homeScreen.hidden = false;
  urlInput.focus();
}

function showResult(data) {
  const audioUrl = new URL(data.audioUrl, window.location.href);
  if (!['http:', 'https:'].includes(audioUrl.protocol)) {
    throw new Error('The provider returned an unsupported audio URL.');
  }
  const fileName = typeof data.fileName === 'string' && data.fileName.trim()
    ? data.fileName.trim() : 'converted-audio.mp3';

  audioPlayer.src = audioUrl.href;
  downloadButton.href = audioUrl.href;
  downloadButton.download = fileName;
  document.querySelector('#resultFileName').textContent = fileName;
  document.querySelector('#resultFileMeta').textContent = data.mimeType || 'MP3 audio';
  homeScreen.hidden = true;
  resultsScreen.hidden = false;
  audioPlayer.load();
}

urlInput.addEventListener('input', () => {
  clearButton.hidden = !urlInput.value;
  setError('');
});

clearButton.addEventListener('click', () => {
  urlInput.value = '';
  clearButton.hidden = true;
  setError('');
  urlInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');

  const sourceUrl = urlInput.value.trim();
  if (!sourceUrl) {
    setError('Paste a source URL to continue.');
    urlInput.focus();
    return;
  }
  if (!isValidHttpUrl(sourceUrl)) {
    setError('Enter a valid URL beginning with http:// or https://.');
    urlInput.focus();
    return;
  }

  // YouTube pages are not direct audio files. This UI deliberately does not
  // extract or download them; connect a provider that explicitly authorizes
  // the requested content and complies with the platform's terms.
  const hostname = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') ||
      hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
    setError('YouTube links are not processed by this frontend. Connect an authorized provider that permits this use, or enter a direct audio URL you have rights to convert.');
    return;
  }

  if (!API_ENDPOINT) {
    setError('Conversion service is not configured yet. Add your authorized backend endpoint in script.js; no conversion has been attempted.');
    return;
  }

  setBusy(true, 'Requesting authorized conversion…');
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl })
    });

    let data;
    try { data = await response.json(); }
    catch { throw new Error('The conversion service returned an unreadable response.'); }

    if (!response.ok || data.success !== true || typeof data.audioUrl !== 'string') {
      throw new Error(data.error || 'The provider could not convert this source.');
    }
    showResult(data);
  } catch (error) {
    setError(error.message || 'Something went wrong. Please try again.');
  } finally {
    setBusy(false);
  }
});

exitButton.addEventListener('click', showHomeAndReset);
