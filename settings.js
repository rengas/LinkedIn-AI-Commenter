// Settings page logic. Reads/writes chrome.storage.local using ALL_DEFAULTS from defaults.js.

const FIELDS = [
  "ollamaUrl",
  "ollamaModel",
  "promptComment",
  "promptReply",
  "promptSummarize",
  "promptRewrite",
  "promptMessage"
];

const TOGGLES = {
  toggleComment: "enableComment",
  toggleReply: "enableReply",
  toggleSummarizer: "enableSummarizer",
  toggleRewrite: "enableRewrite"
};

function $(id) { return document.getElementById(id); }

function loadIntoUI() {
  chrome.storage.local.get(ALL_DEFAULTS, (settings) => {
    FIELDS.forEach(k => { $(k).value = settings[k]; });
    Object.entries(TOGGLES).forEach(([elId, key]) => {
      $(elId).checked = !!settings[key];
    });
  });
}

function collectFromUI() {
  const out = {};
  FIELDS.forEach(k => { out[k] = $(k).value.trim(); });
  Object.entries(TOGGLES).forEach(([elId, key]) => {
    out[key] = $(elId).checked;
  });
  return out;
}

function flashStatus(el, text, kind) {
  el.textContent = text;
  el.className = "status " + (kind || "");
  if (kind === "ok") {
    setTimeout(() => { el.textContent = ""; el.className = "status"; }, 2500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadIntoUI();

  // Reset buttons (per prompt)
  document.querySelectorAll("[data-reset]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const key = btn.getAttribute("data-reset");
      $(key).value = ALL_DEFAULTS[key];
    });
  });

  // Save: write everything to storage
  $("saveBtn").addEventListener("click", () => {
    const data = collectFromUI();
    if (!data.ollamaUrl) {
      flashStatus($("saveStatus"), "Ollama URL is required.", "err");
      return;
    }
    if (!data.ollamaModel) {
      flashStatus($("saveStatus"), "Model name is required.", "err");
      return;
    }
    chrome.storage.local.set(data, () => {
      flashStatus($("saveStatus"), "Saved.", "ok");
    });
  });

  // Live-save toggles (so popup and settings page stay in sync)
  Object.entries(TOGGLES).forEach(([elId, key]) => {
    $(elId).addEventListener("change", (e) => {
      chrome.storage.local.set({ [key]: e.target.checked });
    });
  });

  // Test connection
  $("testBtn").addEventListener("click", async () => {
    const url = $("ollamaUrl").value.trim();
    const model = $("ollamaModel").value.trim();
    if (!url || !model) {
      flashStatus($("testStatus"), "Fill URL and model first.", "err");
      return;
    }
    flashStatus($("testStatus"), "Testing…", "");
    try {
      const resp = await chrome.runtime.sendMessage({
        action: "ollamaTestConnection",
        ollamaUrl: url,
        ollamaModel: model
      });
      if (resp.success) {
        flashStatus($("testStatus"), resp.data.message, resp.data.hasModel ? "ok" : "err");
      } else {
        flashStatus($("testStatus"), resp.error, "err");
      }
    } catch (err) {
      flashStatus($("testStatus"), err.message, "err");
    }
  });
});