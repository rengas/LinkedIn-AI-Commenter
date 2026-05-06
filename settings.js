// Settings page logic. Reads/writes chrome.storage.local using ALL_DEFAULTS from defaults.js.

const FIELDS = [
  "provider",
  "ollamaUrl",
  "ollamaModel",
  "geminiApiKey",
  "geminiModel",
  "claudeApiKey",
  "claudeModel",
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

function showProviderSection(provider) {
  document.querySelectorAll(".provider-section").forEach(el => el.classList.remove("active"));
  const section = $(`section-${provider}`);
  if (section) section.classList.add("active");
}

function loadIntoUI() {
  chrome.storage.local.get(ALL_DEFAULTS, (settings) => {
    FIELDS.forEach(k => { $(k).value = settings[k]; });
    Object.entries(TOGGLES).forEach(([elId, key]) => {
      $(elId).checked = !!settings[key];
    });
    showProviderSection(settings.provider);
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

  $("provider").addEventListener("change", (e) => {
    showProviderSection(e.target.value);
  });

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
    if (data.provider === "ollama") {
      if (!data.ollamaUrl) {
        flashStatus($("saveStatus"), "Ollama URL is required.", "err");
        return;
      }
      if (!data.ollamaModel) {
        flashStatus($("saveStatus"), "Ollama model name is required.", "err");
        return;
      }
    } else if (data.provider === "gemini") {
      if (!data.geminiApiKey) {
        flashStatus($("saveStatus"), "Gemini API key is required.", "err");
        return;
      }
      if (!data.geminiModel) {
        flashStatus($("saveStatus"), "Gemini model name is required.", "err");
        return;
      }
    } else if (data.provider === "claude") {
      if (!data.claudeApiKey) {
        flashStatus($("saveStatus"), "Claude API key is required.", "err");
        return;
      }
      if (!data.claudeModel) {
        flashStatus($("saveStatus"), "Claude model name is required.", "err");
        return;
      }
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

  // Test Ollama connection
  $("testOllamaBtn").addEventListener("click", async () => {
    const url = $("ollamaUrl").value.trim();
    const model = $("ollamaModel").value.trim();
    if (!url || !model) {
      flashStatus($("testOllamaStatus"), "Fill URL and model first.", "err");
      return;
    }
    flashStatus($("testOllamaStatus"), "Testing…", "");
    try {
      const resp = await chrome.runtime.sendMessage({
        action: "ollamaTestConnection",
        ollamaUrl: url,
        ollamaModel: model
      });
      if (resp.success) {
        flashStatus($("testOllamaStatus"), resp.data.message, resp.data.hasModel ? "ok" : "err");
      } else {
        flashStatus($("testOllamaStatus"), resp.error, "err");
      }
    } catch (err) {
      flashStatus($("testOllamaStatus"), err.message, "err");
    }
  });

  // Test Gemini connection
  $("testGeminiBtn").addEventListener("click", async () => {
    const apiKey = $("geminiApiKey").value.trim();
    const model = $("geminiModel").value.trim();
    if (!apiKey || !model) {
      flashStatus($("testGeminiStatus"), "Fill API key and model first.", "err");
      return;
    }
    flashStatus($("testGeminiStatus"), "Testing…", "");
    try {
      const resp = await chrome.runtime.sendMessage({
        action: "geminiTestConnection",
        geminiApiKey: apiKey,
        geminiModel: model
      });
      if (resp.success) {
        flashStatus($("testGeminiStatus"), resp.data.message, resp.data.hasModel ? "ok" : "err");
      } else {
        flashStatus($("testGeminiStatus"), resp.error, "err");
      }
    } catch (err) {
      flashStatus($("testGeminiStatus"), err.message, "err");
    }
  });

  // Test Claude connection
  $("testClaudeBtn").addEventListener("click", async () => {
    const apiKey = $("claudeApiKey").value.trim();
    const model = $("claudeModel").value.trim();
    if (!apiKey || !model) {
      flashStatus($("testClaudeStatus"), "Fill API key and model first.", "err");
      return;
    }
    flashStatus($("testClaudeStatus"), "Testing…", "");
    try {
      const resp = await chrome.runtime.sendMessage({
        action: "claudeTestConnection",
        claudeApiKey: apiKey,
        claudeModel: model
      });
      if (resp.success) {
        flashStatus($("testClaudeStatus"), resp.data.message, resp.data.hasModel ? "ok" : "err");
      } else {
        flashStatus($("testClaudeStatus"), resp.error, "err");
      }
    } catch (err) {
      flashStatus($("testClaudeStatus"), err.message, "err");
    }
  });
});
