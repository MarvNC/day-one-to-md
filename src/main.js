import JSZip from "jszip";
import "./style.css";

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const statusText = document.getElementById("status-text");
const meta = document.getElementById("meta");
const preview = document.getElementById("preview");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");

let currentMarkdown = "";

const state = {
  setReady(message = "Ready") {
    dropZone.classList.remove("processing");
    statusText.className = "status-text";
    statusText.textContent = message;
  },
  setProcessing(message = "Processing file...") {
    dropZone.classList.add("processing");
    statusText.className = "status-text";
    statusText.textContent = message;
  },
  setSuccess(message) {
    dropZone.classList.remove("processing");
    statusText.className = "status-text success";
    statusText.textContent = message;
  },
  setError(message) {
    dropZone.classList.remove("processing");
    statusText.className = "status-text error";
    statusText.textContent = message;
  },
};

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag");

  const [file] = event.dataTransfer?.files ?? [];
  if (!file) return;
  await processFile(file);
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await processFile(file);
  fileInput.value = "";
});

copyBtn.addEventListener("click", async () => {
  if (!currentMarkdown) return;

  try {
    await navigator.clipboard.writeText(currentMarkdown);
    meta.textContent = "Copied markdown to clipboard.";
  } catch {
    preview.focus();
    preview.select();
    meta.textContent = "Clipboard permission blocked. Press Ctrl+C to copy selected output.";
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentMarkdown) return;

  const blob = new Blob([currentMarkdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `day-one-export-${dateStamp()}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  meta.textContent = "Downloaded markdown file.";
});

async function processFile(file) {
  const lowerName = file.name.toLowerCase();
  const isJson = lowerName.endsWith(".json");
  const isZip = lowerName.endsWith(".zip");

  if (!isJson && !isZip) {
    setNoOutput();
    state.setError("Unsupported file type. Use Day One .zip or Journal.json");
    return;
  }

  try {
    state.setProcessing();

    let journal;
    if (isJson) {
      journal = JSON.parse(await file.text());
    } else {
      journal = await parseJournalFromZip(file);
    }

    const entries = Array.isArray(journal?.entries) ? journal.entries : [];
    if (!entries.length) {
      throw new Error("No entries found in Journal.json");
    }

    const markdown = toMarkdown(entries);
    if (!markdown.trim()) {
      throw new Error("Could not build markdown output from entries");
    }

    currentMarkdown = markdown;
    preview.value = markdown;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;

    const sortedEntries = sortEntries(entries);
    const first = formatTimestamp(sortedEntries[0]?.creationDate);
    const last = formatTimestamp(sortedEntries[sortedEntries.length - 1]?.creationDate);
    state.setSuccess(`Done. ${entries.length} entries converted.`);
    meta.textContent = `Range: ${first} to ${last} (UTC). Processed locally in your browser.`;
  } catch (error) {
    setNoOutput();
    state.setError(error?.message || "Failed to process file");
  }
}

async function parseJournalFromZip(file) {
  const zip = await JSZip.loadAsync(file);
  const candidates = [];

  for (const fileName of Object.keys(zip.files)) {
    const normalized = fileName.toLowerCase();
    if (normalized.endsWith("journal.json")) {
      candidates.push(fileName);
    }
  }

  if (!candidates.length) {
    throw new Error("No Journal.json found in zip export");
  }

  candidates.sort((a, b) => a.length - b.length);
  const journalFile = zip.files[candidates[0]];
  const text = await journalFile.async("text");
  return JSON.parse(text);
}

function toMarkdown(entries) {
  const sorted = sortEntries(entries);
  const sections = sorted.map((entry) => {
    const title = formatTimestamp(entry.creationDate || entry.modifiedDate);
    const body = getEntryText(entry);
    return `# ${title}\n\n${body}`.trim();
  });

  return sections.join("\n\n---\n\n");
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => parseDate(a) - parseDate(b));
}

function parseDate(entry) {
  const raw = entry?.creationDate || entry?.modifiedDate || "";
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) {
    return "1970-01-01 00-00-00";
  }

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());
  return `${year}-${month}-${day} ${hour}-${minute}-${second}`;
}

function getEntryText(entry) {
  const text = typeof entry?.text === "string" ? entry.text : "";
  if (text.trim()) {
    return cleanupText(text.trim());
  }

  const richText = entry?.richText;
  if (typeof richText === "string" && richText.trim()) {
    try {
      const parsed = JSON.parse(richText);
      const chunks = Array.isArray(parsed?.contents)
        ? parsed.contents
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
            .trim()
        : "";
      if (chunks) return cleanupText(chunks);
    } catch {
      return "[No content]";
    }
  }

  return "[No content]";
}

function cleanupText(text) {
  return text.replace(/\\([.-])/g, "$1");
}

function setNoOutput() {
  currentMarkdown = "";
  preview.value = "";
  meta.textContent = "";
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
}

function dateStamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  return `${year}-${month}-${day}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

state.setReady();
