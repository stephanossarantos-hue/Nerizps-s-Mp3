# Violet Audio — GitHub Pages Website

A responsive static website built with plain HTML, CSS, and JavaScript.

## Files

- `index.html` — website markup and screens
- `style.css` — responsive dark purple/blue theme
- `script.js` — URL validation, loading/error states, results UI, and provider API integration

## Run locally

Open `index.html` in a browser, or serve this folder with a local static server.

## Publish with GitHub Pages

1. Create a new GitHub repository (for example, `violet-audio`).
2. Upload `index.html`, `style.css`, `script.js`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site. The URL will look like `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Conversion integration

GitHub Pages hosts static frontend files only. It cannot run a private conversion server or safely store API secrets.

In `script.js`, set `API_ENDPOINT` to your separately hosted backend endpoint. The frontend sends:

```json
{ "sourceUrl": "https://example.com/audio" }
```

The backend should return a real provider result:

```json
{
  "success": true,
  "audioUrl": "https://provider.example/file.mp3",
  "fileName": "converted-audio.mp3",
  "mimeType": "audio/mpeg"
}
```

The backend must verify that the requester is authorized to convert the content and comply with the source platform's terms. The frontend does not extract YouTube audio, bypass access controls, or fake a successful conversion. YouTube links are currently rejected by the frontend.

If the endpoint is on another domain, configure CORS on your backend to allow your GitHub Pages origin.
