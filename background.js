/**
 * LinkedIn AI Commenter - Background Script
 * Routes generation requests to either a local Ollama instance or the Gemini API
 * based on the user's chosen provider in settings.
 */

importScripts("defaults.js");

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CLAUDE_BASE = "https://api.anthropic.com/v1";
const CLAUDE_API_VERSION = "2023-06-01";

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateComment") {
    generateContent(
      request.parentComment ? "reply" : "comment",
      { postContent: request.postContent, parentComment: request.parentComment }
    )
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "summarizePost") {
    generateContent("summarize", { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "rewritePost") {
    generateContent("rewrite", { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "generateMessageReply") {
    generateContent("message", { history: request.history })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "ollamaTestConnection") {
    testOllamaConnection(request.ollamaUrl, request.ollamaModel)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "geminiTestConnection") {
    testGeminiConnection(request.geminiApiKey, request.geminiModel)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "claudeTestConnection") {
    testClaudeConnection(request.claudeApiKey, request.claudeModel)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

function buildUserPrompt(action, context) {
  switch (action) {
    case "comment":
      return `Post:\n"""\n${context.postContent}\n"""`;
    case "reply":
      return `Post:\n"""\n${context.postContent}\n"""\n\nComment to reply to:\n"""\n${context.parentComment}\n"""`;
    case "summarize":
      return `Post:\n"""\n${context.postContent}\n"""`;
    case "rewrite":
      return `Draft post:\n"""\n${context.postContent}\n"""`;
    case "message":
      return `Conversation so far:\n"""\n${context.history}\n"""`;
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}

const PROMPT_KEY_BY_ACTION = {
  comment: "promptComment",
  reply: "promptReply",
  summarize: "promptSummarize",
  rewrite: "promptRewrite",
  message: "promptMessage"
};

async function generateContent(action, context) {
  const settings = await chrome.storage.local.get(self.ALL_DEFAULTS);
  const systemPrompt = settings[PROMPT_KEY_BY_ACTION[action]];
  const userPrompt = buildUserPrompt(action, context);

  if (settings.provider === "gemini") {
    return generateWithGemini(settings, systemPrompt, userPrompt, action);
  }
  if (settings.provider === "claude") {
    return generateWithClaude(settings, systemPrompt, userPrompt, action);
  }
  return generateWithOllama(settings, systemPrompt, userPrompt, action);
}

async function generateWithOllama(settings, systemPrompt, userPrompt, action) {
  const url = `${settings.ollamaUrl.replace(/\/+$/, "")}/api/chat`;
  const body = {
    model: settings.ollamaModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false,
    options: { temperature: 0.7 }
  };

  console.log(`[Ollama] ${action} → ${url} (${settings.ollamaModel})`);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${settings.ollamaUrl}. Is Ollama running? ` +
      `Start it with "ollama serve" and ensure the model "${settings.ollamaModel}" is pulled. (${err.message})`
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 404) {
      throw new Error(
        `Model "${settings.ollamaModel}" not found. Pull it with: ollama pull ${settings.ollamaModel}`
      );
    }
    throw new Error(`Ollama error ${response.status}: ${errText || response.statusText}`);
  }

  const result = await response.json();
  const content = result?.message?.content;
  if (!content) {
    throw new Error("Ollama returned no content. Response: " + JSON.stringify(result));
  }
  return content.trim();
}

async function generateWithGemini(settings, systemPrompt, userPrompt, action) {
  if (!settings.geminiApiKey) {
    throw new Error("Gemini API key is not set. Open the extension settings to add one.");
  }
  const model = settings.geminiModel;
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.7 }
  };

  console.log(`[Gemini] ${action} → ${model}`);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.geminiApiKey
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(`Could not reach Gemini API: ${err.message}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Gemini rejected the API key (${response.status}). Check the key in settings.`);
    }
    if (response.status === 404) {
      throw new Error(`Gemini model "${model}" not found. Check the model name in settings.`);
    }
    throw new Error(`Gemini error ${response.status}: ${errText || response.statusText}`);
  }

  const result = await response.json();
  const parts = result?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map(p => p?.text || "").join("") : "";
  if (!text) {
    const blockReason = result?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked the request (${blockReason}).`);
    }
    throw new Error("Gemini returned no content. Response: " + JSON.stringify(result));
  }
  return text.trim();
}

async function generateWithClaude(settings, systemPrompt, userPrompt, action) {
  if (!settings.claudeApiKey) {
    throw new Error("Claude API key is not set. Open the extension settings to add one.");
  }
  const model = settings.claudeModel;
  const url = `${CLAUDE_BASE}/messages`;
  const body = {
    model,
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  };

  console.log(`[Claude] ${action} → ${model}`);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.claudeApiKey,
        "anthropic-version": CLAUDE_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(`Could not reach Claude API: ${err.message}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Claude rejected the API key (${response.status}). Check the key in settings.`);
    }
    if (response.status === 404) {
      throw new Error(`Claude model "${model}" not found. Check the model name in settings.`);
    }
    throw new Error(`Claude error ${response.status}: ${errText || response.statusText}`);
  }

  const result = await response.json();
  const blocks = result?.content;
  const text = Array.isArray(blocks)
    ? blocks.filter(b => b?.type === "text").map(b => b.text || "").join("")
    : "";
  if (!text) {
    throw new Error("Claude returned no content. Response: " + JSON.stringify(result));
  }
  return text.trim();
}

async function testOllamaConnection(ollamaUrl, ollamaModel) {
  const base = ollamaUrl.replace(/\/+$/, "");
  // 1) Check server reachable via /api/tags
  let tagsResp;
  try {
    tagsResp = await fetch(`${base}/api/tags`, { method: "GET" });
  } catch (err) {
    throw new Error(`Cannot reach Ollama at ${ollamaUrl}: ${err.message}`);
  }
  if (!tagsResp.ok) {
    throw new Error(`Ollama responded with ${tagsResp.status} on /api/tags`);
  }
  const tags = await tagsResp.json();
  const models = (tags.models || []).map(m => m.name);
  const hasModel = models.some(name => name === ollamaModel || name.startsWith(ollamaModel + ":"));
  return {
    reachable: true,
    models,
    hasModel,
    message: hasModel
      ? `Connected. Model "${ollamaModel}" is available.`
      : `Connected, but model "${ollamaModel}" is not pulled. Run: ollama pull ${ollamaModel}`
  };
}

async function testGeminiConnection(geminiApiKey, geminiModel) {
  if (!geminiApiKey) throw new Error("API key is required.");
  let resp;
  try {
    resp = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModel)}`, {
      method: "GET",
      headers: { "x-goog-api-key": geminiApiKey }
    });
  } catch (err) {
    throw new Error(`Cannot reach Gemini API: ${err.message}`);
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`API key rejected (${resp.status}).`);
  }
  if (resp.status === 404) {
    return {
      reachable: true,
      hasModel: false,
      message: `Connected, but model "${geminiModel}" was not found.`
    };
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Gemini error ${resp.status}: ${errText || resp.statusText}`);
  }
  return {
    reachable: true,
    hasModel: true,
    message: `Connected. Model "${geminiModel}" is available.`
  };
}

async function testClaudeConnection(claudeApiKey, claudeModel) {
  if (!claudeApiKey) throw new Error("API key is required.");
  let resp;
  try {
    resp = await fetch(`${CLAUDE_BASE}/models/${encodeURIComponent(claudeModel)}`, {
      method: "GET",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": CLAUDE_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      }
    });
  } catch (err) {
    throw new Error(`Cannot reach Claude API: ${err.message}`);
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`API key rejected (${resp.status}).`);
  }
  if (resp.status === 404) {
    return {
      reachable: true,
      hasModel: false,
      message: `Connected, but model "${claudeModel}" was not found.`
    };
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Claude error ${resp.status}: ${errText || resp.statusText}`);
  }
  return {
    reachable: true,
    hasModel: true,
    message: `Connected. Model "${claudeModel}" is available.`
  };
}
