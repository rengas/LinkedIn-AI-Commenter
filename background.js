/**
 * LinkedIn AI Commenter - Background Script
 * Calls a local Ollama instance directly. No remote API.
 */

importScripts("defaults.js");

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
