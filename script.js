'use strict';

// Set this to your deployed backend URL when the website is hosted on GitHub Pages.
// Example: https://your-violet-audio-api.example.com/api/convert
const API_ENDPOINT = 'http://localhost:3000/api/convert';

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

function setError(message = '') { errorMessage.textContent = message; }

function validWebUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && Boolean(u.hostname);
  } catch { return false; }
}

function classifySource(value) {
  const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  return 'direct-or-other';
}

function setBusy(busy, message = 'Contacting conversion provider…') {
  convertButton.disabled = busy;
  convertButton.querySelector('.button-label').textContent = busy ? 'Converting…' : 'Convert to MP3';
  loadingText.textContent = message;
  loadingState.hidden = !busy;
}

function resetToHome() {
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
  const audioUrl = new URL(data.audioUrl);
  if (audioUrl.protocol !== 'https:' && audioUrl.hostname !== 'localhost') {
    throw new Error('The provider returned an insecure audio URL.');
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
  setError();

  const sourceUrl = urlInput.value.trim();
  if (!sourceUrl) {
    setError('Paste a YouTube or direct audio URL first.');
    urlInput.focus();
    return;
  }
  if (!validWebUrl(sourceUrl)) {
    setError('Enter a valid URL beginning with http:// or https://.');
    urlInput.focus();
    return;
  }

  const sourceType = classifySource(sourceUrl);
  setBusy(true, sourceType === 'youtube'
    ? 'Checking YouTube source permissions…'
    : 'Checking direct audio source…');

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl, outputFormat: 'mp3' })
    });

    let data;
    try { data = await response.json(); }
    catch { throw new Error('The conversion server returned an unreadable response.'); }

    if (!response.ok || data.success !== true || typeof data.audioUrl !== 'string') {
      throw new Error(data.error || 'The provider could not process this source.');
    }
    showResult(data);
  } catch (err) {
    if (err instanceof TypeError) {
      setError('Cannot reach the conversion server. Check that the backend is deployed and API_ENDPOINT is configured.');
    } else {
      setError(err.message || 'Conversion failed. Please try again.');
    }
  } finally {
    setBusy(false);
  }
});

exitButton.addEventListener('click', resetToHome);
