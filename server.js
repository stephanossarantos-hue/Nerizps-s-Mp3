const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");
const { randomUUID } = require("crypto");

const app = express();
const upload = multer({ dest: path.join(os.tmpdir(), "nerizps-uploads"), limits: { fileSize: 250 * 1024 * 1024 } });
const PORT = process.env.PORT || 3000;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

app.use(express.json({limit:"20kb"}));
app.use(express.static(path.join(__dirname, "public")));

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] >= 224;
  }
  if (net.isIPv6(ip)) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip === "::";
  return true;
}
async function validatePublicUrl(value) {
  const u = new URL(value);
  if (!["http:","https:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS URLs are accepted.");
  if (u.username || u.password) throw new Error("URLs containing credentials are not accepted.");
  const records = await dns.lookup(u.hostname, {all:true});
  if (!records.length || records.some(r => isPrivateIp(r.address))) throw new Error("This host is not publicly reachable.");
  return u;
}
async function fetchAudio(url, destination) {
  let current = url;
  for (let redirects = 0; redirects <= 4; redirects++) {
    await validatePublicUrl(current);
    const response = await fetch(current, {redirect:"manual", signal: AbortSignal.timeout(45000)});
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Audio host returned an invalid redirect.");
      current = new URL(location, current).href; continue;
    }
    if (!response.ok) throw new Error(`Audio host returned HTTP ${response.status}.`);
    const type = response.headers.get("content-type") || "";
    if (!(type.startsWith("audio/") || type === "application/octet-stream")) throw new Error("That URL did not return an audio file.");
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 250 * 1024 * 1024) throw new Error("Remote audio is over the 250 MB limit.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 250 * 1024 * 1024) throw new Error("Remote audio is over the 250 MB limit.");
    fs.writeFileSync(destination, bytes);
    return {name:path.basename(new URL(current).pathname) || "remote-audio", size:bytes.length};
  }
  throw new Error("Too many redirects from the audio host.");
}
function convert(input, output, bitrate) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ["-nostdin","-y","-i",input,"-vn","-codec:a","libmp3lame","-b:a",`${bitrate}k`,"-f","mp3",output]);
    let err = "";
    proc.stderr.on("data", d => err += d.toString());
    proc.on("error", e => reject(new Error(`Could not start FFmpeg. Install FFmpeg and ensure it is on PATH. ${e.message}`)));
    proc.on("close", code => code === 0 ? resolve() : reject(new Error("Could not decode this audio file. Try another audio format.")));
  });
}
app.post("/api/remote-info", async (req,res) => {
  try {
    const u = await validatePublicUrl(req.body?.url);
    res.json({name:path.basename(u.pathname) || "remote-audio"});
  } catch(e) { res.status(400).json({error:e.message}); }
});
app.post("/api/convert", upload.single("audio"), async (req,res) => {
  const id = randomUUID(), dir = path.join(os.tmpdir(), `nerizps-${id}`);
  fs.mkdirSync(dir, {recursive:true});
  const input = path.join(dir, "input-audio"), output = path.join(dir, "converted.mp3");
  try {
    const bitrate = String(req.body.bitrate || "192");
    if (!["128","192","256","320"].includes(bitrate)) throw new Error("Choose a valid MP3 bitrate.");
    if (req.file) fs.renameSync(req.file.path, input);
    else if (req.body.url) await fetchAudio(req.body.url, input);
    else throw new Error("Upload an audio file or provide a direct audio URL.");
    await convert(input, output, bitrate);
    res.setHeader("Content-Type","audio/mpeg");
    res.setHeader("Content-Disposition",'attachment; filename="nerizps-audio.mp3"');
    res.sendFile(output, err => { fs.rmSync(dir,{recursive:true,force:true}); if (err && !res.headersSent) res.status(500).end(); });
  } catch(e) {
    if (req.file?.path) fs.rmSync(req.file.path,{force:true});
    fs.rmSync(dir,{recursive:true,force:true});
    res.status(400).json({error:e.message});
  }
});
app.get("/health",(_,res)=>res.json({ok:true,app:"Nerizps Audio"}));
app.listen(PORT,()=>console.log(`Nerizps Audio running on http://localhost:${PORT}`));
