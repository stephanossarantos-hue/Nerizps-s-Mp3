import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet());
app.use(express.json({ limit: '20kb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:5500')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests without Origin are allowed for local health checks / server tools.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use('/api/', rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'violet-audio-api' }));

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && Boolean(u.hostname);
  } catch { return false; }
}

app.post('/api/convert', async (req, res) => {
  const { sourceUrl, outputFormat } = req.body || {};

  if (typeof sourceUrl !== 'string' || !isHttpUrl(sourceUrl)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid HTTP or HTTPS source URL.' });
  }
  if (outputFormat !== 'mp3') {
    return res.status(400).json({ success: false, error: 'Only MP3 output is supported.' });
  }

  const providerUrl = process.env.CONVERTER_PROVIDER_URL;
  const providerKey = process.env.CONVERTER_PROVIDER_KEY;

  if (!providerUrl || !providerKey) {
    return res.status(503).json({
      success: false,
      error: 'The authorized conversion provider is not configured yet. No conversion was performed.'
    });
  }

  try {
    // Provider contract: POST { sourceUrl, outputFormat } with Bearer auth.
    // Provider must independently verify rights/authorization for the source.
    const providerResponse = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerKey}`
      },
      body: JSON.stringify({ sourceUrl, outputFormat: 'mp3' }),
      signal: AbortSignal.timeout(45_000)
    });

    const result = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok || !result || result.success !== true || typeof result.audioUrl !== 'string') {
      const message = result && typeof result.error === 'string'
        ? result.error : 'The authorized provider rejected or could not convert this source.';
      return res.status(502).json({ success: false, error: message });
    }

    let audio;
    try { audio = new URL(result.audioUrl); } catch {
      return res.status(502).json({ success: false, error: 'Provider returned an invalid audio URL.' });
    }
    if (audio.protocol !== 'https:') {
      return res.status(502).json({ success: false, error: 'Provider must return a secure HTTPS audio URL.' });
    }

    return res.json({
      success: true,
      audioUrl: audio.href,
      fileName: typeof result.fileName === 'string' ? result.fileName : 'converted-audio.mp3',
      mimeType: typeof result.mimeType === 'string' ? result.mimeType : 'audio/mpeg'
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(502).json({
      success: false,
      error: timedOut ? 'The conversion provider took too long. Try again.' : 'Could not contact the conversion provider.'
    });
  }
});

app.listen(port, () => console.log(`Violet Audio API listening on port ${port}`));
