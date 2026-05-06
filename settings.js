// Settings page logic. Reads/writes chrome.storage.local using ALL_DEFAULTS from defaults.js.

const FIELDS = [
  "provider",
  "ollamaUrl",
  "ollamaModel",
  "geminiApiKey",
  "geminiModel",
  "claudeApiKey",
  "claudeModel"
];

const TOGGLES = {
  toggleComment: "enableComment",
  toggleReply: "enableReply",
  toggleSummarizer: "enableSummarizer",
  toggleRewrite: "enableRewrite"
};

// Maps prompt textarea element id → persona.prompts key.
const PROMPT_TEXTAREA_TO_KEY = {
  promptComment: "comment",
  promptReply: "reply",
  promptSummarize: "summarize",
  promptRewrite: "rewrite",
  promptMessage: "message"
};

let personas = [];
let activePersonaId = null;

function $(id) { return document.getElementById(id); }

function newPersonaId() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getActivePersona() {
  return personas.find(p => p.id === activePersonaId) || personas[0];
}

function showProviderSection(provider) {
  document.querySelectorAll(".provider-section").forEach(el => el.classList.remove("active"));
  const section = $(`section-${provider}`);
  if (section) section.classList.add("active");
}

// Pull current textarea values into the active persona's prompts (in memory only).
function syncPromptsToActivePersona() {
  const persona = getActivePersona();
  if (!persona) return;
  if (!persona.prompts) persona.prompts = {};
  Object.entries(PROMPT_TEXTAREA_TO_KEY).forEach(([elId, key]) => {
    persona.prompts[key] = $(elId).value;
  });
}

function renderPersonaSelect() {
  const sel = $("personaSelect");
  sel.innerHTML = "";
  personas.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === activePersonaId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderPersonaPrompts() {
  const persona = getActivePersona();
  if (!persona) return;
  Object.entries(PROMPT_TEXTAREA_TO_KEY).forEach(([elId, key]) => {
    $(elId).value = (persona.prompts && persona.prompts[key]) || DEFAULT_PROMPTS[key];
  });
}

function persistPersonas() {
  chrome.storage.local.set({ personas, activePersonaId });
}

function loadIntoUI() {
  // Use null to read everything stored, so we can detect missing keys for migration.
  chrome.storage.local.get(null, (raw) => {
    const settings = { ...ALL_DEFAULTS, ...raw };

    FIELDS.forEach(k => {
      if ($(k)) $(k).value = settings[k];
    });
    Object.entries(TOGGLES).forEach(([elId, key]) => {
      $(elId).checked = !!settings[key];
    });
    showProviderSection(settings.provider);

    // Personas — migrate legacy promptX fields if no personas array yet.
    let needsPersist = false;
    if (Array.isArray(raw.personas) && raw.personas.length) {
      personas = raw.personas;
    } else {
      personas = [{
        id: DEFAULT_PERSONA_ID,
        name: "Default",
        prompts: {
          comment: raw.promptComment || DEFAULT_PROMPTS.comment,
          reply: raw.promptReply || DEFAULT_PROMPTS.reply,
          summarize: raw.promptSummarize || DEFAULT_PROMPTS.summarize,
          rewrite: raw.promptRewrite || DEFAULT_PROMPTS.rewrite,
          message: raw.promptMessage || DEFAULT_PROMPTS.message
        }
      }];
      needsPersist = true;
    }
    activePersonaId =
      raw.activePersonaId && personas.find(p => p.id === raw.activePersonaId)
        ? raw.activePersonaId
        : personas[0].id;

    renderPersonaSelect();
    renderPersonaPrompts();

    if (needsPersist) {
      persistPersonas();
      // Clean up legacy keys — they've been migrated into the default persona.
      chrome.storage.local.remove([
        "promptComment", "promptReply", "promptSummarize", "promptRewrite", "promptMessage"
      ]);
    }
  });
}

function collectFromUI() {
  syncPromptsToActivePersona();
  const out = { personas, activePersonaId };
  FIELDS.forEach(k => {
    if ($(k)) out[k] = $(k).value.trim();
  });
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

  // Persona switch — capture in-flight prompt edits, switch, render, persist.
  $("personaSelect").addEventListener("change", (e) => {
    syncPromptsToActivePersona();
    activePersonaId = e.target.value;
    renderPersonaPrompts();
    persistPersonas();
  });

  $("addPersonaBtn").addEventListener("click", () => {
    const name = (prompt("Name for the new persona?", `Persona ${personas.length + 1}`) || "").trim();
    if (!name) return;
    syncPromptsToActivePersona();
    const persona = {
      id: newPersonaId(),
      name,
      prompts: { ...DEFAULT_PROMPTS }
    };
    personas.push(persona);
    activePersonaId = persona.id;
    renderPersonaSelect();
    renderPersonaPrompts();
    persistPersonas();
    flashStatus($("personaStatus"), `Added "${name}".`, "ok");
  });

  $("renamePersonaBtn").addEventListener("click", () => {
    const persona = getActivePersona();
    if (!persona) return;
    const name = (prompt("Rename persona:", persona.name) || "").trim();
    if (!name || name === persona.name) return;
    persona.name = name;
    renderPersonaSelect();
    persistPersonas();
    flashStatus($("personaStatus"), "Renamed.", "ok");
  });

  $("deletePersonaBtn").addEventListener("click", () => {
    if (personas.length <= 1) {
      flashStatus($("personaStatus"), "Can't delete the last persona.", "err");
      return;
    }
    const persona = getActivePersona();
    if (!persona) return;
    if (!confirm(`Delete persona "${persona.name}"? This can't be undone.`)) return;
    personas = personas.filter(p => p.id !== persona.id);
    activePersonaId = personas[0].id;
    renderPersonaSelect();
    renderPersonaPrompts();
    persistPersonas();
    flashStatus($("personaStatus"), "Deleted.", "ok");
  });

  // Reset buttons (per prompt) — reset only the active persona's prompt for that field.
  document.querySelectorAll("[data-reset]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const elId = btn.getAttribute("data-reset");
      const key = PROMPT_TEXTAREA_TO_KEY[elId];
      if (!key) return;
      $(elId).value = DEFAULT_PROMPTS[key];
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
