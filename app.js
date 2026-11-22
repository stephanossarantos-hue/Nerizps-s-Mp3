const $ = id => document.getElementById(id);
let currentFile = null, downloadUrl = null;
const setMessage = text => $("message").textContent = text;
function chooseTab(tab) {
  document.querySelectorAll(".source-tab").forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  $("filePane").classList.toggle("hidden", tab !== "file");
  $("urlPane").classList.toggle("hidden", tab !== "url");
}
document.querySelectorAll(".source-tab").forEach(b => b.addEventListener("click", () => chooseTab(b.dataset.tab)));

function setAudio(file) {
  if (!file) return;
  if (file.size > 250 * 1024 * 1024) return setMessage("File is over the 250 MB limit.");
  if (!file.type.startsWith("audio/") && !/\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i.test(file.name))
    return setMessage("Please choose a supported audio file.");
  currentFile = file;
  $("fileName").textContent = file.name;
  $("fileSize").textContent = `${(file.size / 1048576).toFixed(2)} MB · Ready`;
  $("selected").classList.remove("hidden");
  $("convert").disabled = false;
  $("download").classList.add("hidden");
  $("progressWrap").classList.add("hidden");
  setMessage("Audio ready. Choose your quality and convert.");
}
$("audioFile").addEventListener("change", e => setAudio(e.target.files[0]));
$("clearFile").addEventListener("click", () => {
  currentFile = null; $("audioFile").value = ""; $("selected").classList.add("hidden");
  $("convert").disabled = true; $("download").classList.add("hidden"); setMessage("Choose a file or paste a direct audio URL.");
});
const drop = $("dropArea");
["dragenter","dragover"].forEach(ev => drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(ev => drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>setAudio(e.dataTransfer.files[0]));

$("loadUrl").addEventListener("click", async () => {
  const value = $("audioUrl").value.trim();
  if (!value) return setMessage("Paste a direct audio-file URL first.");
  try {
    const parsed = new URL(value);
    if (!["http:","https:"].includes(parsed.protocol)) throw new Error("Use a valid http or https URL.");
    if (/youtube\.com|youtu\.be/i.test(parsed.hostname)) throw new Error("YouTube watch links are not supported. Use a direct audio-file URL from a source that permits downloading.");
    setMessage("Checking audio link…");
    const response = await fetch("/api/remote-info", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:parsed.href})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load that audio URL.");
    currentFile = {remoteUrl: parsed.href, name: data.name || "remote-audio", size: data.size || 0};
    $("fileName").textContent = currentFile.name;
    $("fileSize").textContent = currentFile.size ? `${(currentFile.size/1048576).toFixed(2)} MB · Link ready` : "Direct audio link · Ready";
    $("selected").classList.remove("hidden"); $("convert").disabled = false;
    $("download").classList.add("hidden"); setMessage("Audio link ready. Convert when you're ready.");
    chooseTab("url");
  } catch (err) { setMessage(err.message || "Could not access that URL."); }
});

$("convert").addEventListener("click", async () => {
  if (!currentFile) return;
  $("convert").disabled = true; $("download").classList.add("hidden");
  $("progressWrap").classList.remove("hidden"); $("progressBar").style.width = "12%";
  $("progressPct").textContent = "12%"; $("progressText").textContent = "Preparing conversion…";
  const form = new FormData();
  form.append("bitrate", $("bitrate").value);
  if (currentFile.remoteUrl) form.append("url", currentFile.remoteUrl);
  else form.append("audio", currentFile, currentFile.name);
  try {
    $("progressBar").style.width = "35%"; $("progressPct").textContent = "35%";
    $("progressText").textContent = "Converting to MP3…"; setMessage("Processing audio on the server. Large files may take a little longer.");
    const response = await fetch("/api/convert", {method:"POST",body:form});
    if (!response.ok) {
      let msg = "Conversion failed.";
      try { msg = (await response.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    $("progressBar").style.width = "100%"; $("progressPct").textContent = "100%";
    $("progressText").textContent = "Conversion complete";
    const blob = await response.blob();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    const link = $("download"); link.href = downloadUrl;
    link.download = (currentFile.name || "nerizps-audio").replace(/\.[^.]+$/,"").replace(/[^\w-]+/g,"-") + ".mp3";
    link.classList.remove("hidden"); setMessage(`Done! Your ${(blob.size/1048576).toFixed(2)} MB MP3 is ready.`);
  } catch (err) { $("progressWrap").classList.add("hidden"); setMessage(err.message); }
  finally { $("convert").disabled = !currentFile; }
});
