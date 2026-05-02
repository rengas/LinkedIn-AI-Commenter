// LinkedIn AI Commenter — content script

// ===== Inline styles =====
// Inject as a <style> tag rather than a manifest content_scripts CSS, so the
// stylesheet has no chrome-extension:// href that pages can fingerprint.
(function injectStyles() {
  const css = `
.ai-generate-btn, .ai-rewrite-btn {
  background-color: #71b7fb;
  color: #004182;
  border: 1px solid #004182;
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  display: inline-block;
  transition: all 0.2s ease;
}
.ai-generate-btn:hover, .ai-rewrite-btn:hover { background-color: #dbeeff; }
.ai-generate-btn:disabled, .ai-rewrite-btn:disabled, .ai-summarize-btn:disabled {
  background-color: #ccc; cursor: not-allowed; border-color: #999; color: #666;
}
.ai-summarize-btn {
  border-radius: 16px; padding: 4px 10px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.2s ease;
}
.ai-summarize-btn:hover { background-color: #f3f2ef !important; }

.ai-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483647;
  font-family: -apple-system, system-ui, "Segoe UI", sans-serif;
}
.ai-overlay-card {
  background: #fff; border-radius: 12px;
  width: min(560px, 92%); max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 12px 48px rgba(0,0,0,0.25);
  overflow: hidden;
}
.ai-overlay-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid #eee;
  font-size: 14px; font-weight: 600; color: #1a1a1a;
}
.ai-overlay-close {
  background: none; border: none; cursor: pointer;
  font-size: 22px; line-height: 1; color: #666; padding: 0 4px;
}
.ai-overlay-body {
  padding: 16px 18px; overflow: auto;
  white-space: pre-wrap; line-height: 1.5; font-size: 14px; color: #1a1a1a;
}
`;
  const style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();

// ===== Settings state =====
const DEFAULT_TOGGLES = {
  enableComment: true,
  enableReply: true,
  enableSummarizer: true,
  enableRewrite: true
};
const settings = { ...DEFAULT_TOGGLES };

(async () => {
  const stored = await chrome.storage.local.get(DEFAULT_TOGGLES);
  Object.assign(settings, stored);
})();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  for (const key of Object.keys(changes)) {
    if (key in DEFAULT_TOGGLES) settings[key] = changes[key].newValue;
  }
});

// ===== Throttled DOM observer =====
// Single shared scheduler. Coalesces mutation bursts into one pass per ~250ms,
// and ignores mutations whose only added nodes are our own buttons (otherwise
// every appendChild we do triggers another reconciliation pass).
const OUR_CLASSES = new Set([
  "ai-btn-container",
  "ai-generate-btn",
  "ai-summarize-btn",
  "ai-rewrite-btn",
  "ai-msg-reply-btn",
  "ai-overlay"
]);

function isOurNode(node) {
  if (node.nodeType !== 1) return true; // text/comment nodes are uninteresting
  if (!node.classList) return false;
  for (const c of OUR_CLASSES) if (node.classList.contains(c)) return true;
  return false;
}

let injectTimer = null;
function scheduleInject() {
  if (injectTimer !== null) return;
  injectTimer = setTimeout(() => {
    injectTimer = null;
    injectCommentButtons();
    injectSummarizeButtons();
    injectImproveButtons();
    injectMessageButtons();
  }, 250);
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes.length === 0) continue;
    for (const node of m.addedNodes) {
      if (!isOurNode(node)) {
        scheduleInject();
        return;
      }
    }
  }
});

function startObserving() {
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleInject();
}

if (document.body) startObserving();
else document.addEventListener("DOMContentLoaded", startObserving, { once: true });


// ===== Inject: comment / reply buttons =====
function injectCommentButtons() {
  const editors = document.querySelectorAll('[role="textbox"], .ql-editor');

  editors.forEach(editor => {
    if (editor.getAttribute("aria-label")?.includes("Search")) return;
    if (editor.closest(".search-global-typeahead__input")) return;
    if (editor.closest(".share-creation-state") || editor.closest(".share-box-v2")) return;
    if (editor.closest(".msg-form__contenteditable") || editor.closest(".msg-form__message-text-editor")) return;

    const container =
      editor.closest(".comments-comment-box__form-container") ||
      editor.closest("form") ||
      editor.parentElement;
    if (!container || container.querySelector(".ai-generate-btn")) return;

    const isInsideComment = !!editor.closest(".comments-comment-item");
    const isInsideReply = !!editor.closest(".comments-reply-item");

    const submitBtn =
      container.querySelector(".comments-comment-box__submit-button--primary") ||
      container.querySelector('button[type="submit"]') ||
      container.querySelector(".artdeco-button--primary");
    const submitText = submitBtn ? submitBtn.innerText.trim() : "";

    const placeholder = editor.getAttribute("placeholder") || "";
    const ariaLabel = editor.getAttribute("aria-label") || "";
    const isReplyPlaceholder =
      placeholder.toLowerCase().includes("reply") || ariaLabel.toLowerCase().includes("reply");

    const isReply = isInsideComment || isInsideReply || submitText === "Reply" || isReplyPlaceholder;

    if (isReply && !settings.enableReply) return;
    if (!isReply && !settings.enableComment) return;

    const btn = createButton(isReply ? "Assist Reply" : "AI Comment", "ai-generate-btn");
    btn.style.marginTop = "5px";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGeneration(btn, editor, "generateComment");
    });

    const wrap = document.createElement("div");
    wrap.className = "ai-btn-container";
    wrap.style.cssText = "display:inline-flex;gap:8px;align-items:center;";
    wrap.appendChild(btn);

    if (submitBtn?.parentElement) {
      submitBtn.parentElement.insertBefore(wrap, submitBtn.nextSibling);
      wrap.style.marginLeft = "8px";
    } else {
      const buttonBar = container.querySelector(".comments-comment-box__detour-icons");
      if (buttonBar?.parentElement) buttonBar.parentElement.insertBefore(wrap, buttonBar.nextSibling);
      else container.appendChild(wrap);
    }
  });
}


// ===== Inject: summarize buttons (one per post) =====
function injectSummarizeButtons() {
  if (!settings.enableSummarizer) return;
  const posts = document.querySelectorAll(".feed-shared-update-v2, .occludable-update");

  posts.forEach(post => {
    const actionBar = post.querySelector(".feed-shared-social-action-bar");
    if (!actionBar || actionBar.querySelector(".ai-summarize-btn")) return;

    const btn = createButton("Summarize", "ai-summarize-btn");
    btn.style.cssText +=
      "margin-left:8px;display:inline-flex;align-items:center;background:transparent;border:none;color:#666;font-weight:600;cursor:pointer;padding:8px;";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGeneration(btn, post, "summarizePost");
    });

    actionBar.appendChild(btn);
  });
}


// ===== Inject: post rewrite button =====
function injectImproveButtons() {
  if (!settings.enableRewrite) return;
  const modal = document.querySelector(".share-creation-state");
  if (!modal) return;

  const editor = modal.querySelector('[role="textbox"]');
  if (!editor) return;

  const footer =
    modal.querySelector(".share-creation-state__bottom-container") ||
    modal.querySelector(".share-box-v2__bottom-container");
  if (!footer || footer.querySelector(".ai-rewrite-btn")) return;

  const btn = createButton("Post Rewrite", "ai-rewrite-btn");
  btn.style.margin = "10px 0";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleGeneration(btn, editor, "rewritePost");
  });

  if (footer.firstChild) footer.insertBefore(btn, footer.firstChild);
  else footer.appendChild(btn);
}


// ===== Inject: message reply buttons =====
function injectMessageButtons() {
  const editors = document.querySelectorAll(
    '.msg-form__contenteditable[role="textbox"], .msg-form__message-text-editor [role="textbox"]'
  );

  editors.forEach(editor => {
    const form = editor.closest("form");
    if (!form) return;

    const sendBtn = form.querySelector(".msg-form__send-button");
    if (!sendBtn || sendBtn.parentElement.querySelector(".ai-msg-reply-btn")) return;

    const btn = createButton("Smart Reply", "ai-msg-reply-btn");
    btn.style.cssText += "margin-right:8px;padding:4px 10px;font-size:12px;";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGeneration(btn, editor, "generateMessageReply");
    });

    sendBtn.parentElement.insertBefore(btn, sendBtn);
  });
}


// ===== Core: handle a generation request =====
async function handleGeneration(btn, contextNode, action) {
  const originalText = btn.innerText;
  btn.innerText = "Working...";
  btn.disabled = true;

  try {
    const payload = { action };

    if (action === "generateComment") {
      payload.postContent = findPostText(contextNode);
      payload.parentComment = findParentComment(contextNode);
      if (!payload.postContent) throw new Error("Could not find post text.");
    } else if (action === "summarizePost") {
      payload.postContent = findPostText(contextNode);
      if (!payload.postContent) throw new Error("Could not find post text.");
    } else if (action === "rewritePost") {
      payload.postContent =
        contextNode.innerText ||
        contextNode.value ||
        contextNode.textContent ||
        contextNode.querySelector("p")?.innerText ||
        "";
      if (!payload.postContent || payload.postContent.trim().length < 2) {
        throw new Error("Please write some text to rewrite first.");
      }
    } else if (action === "generateMessageReply") {
      payload.history = findMessageHistory(contextNode);
      if (!payload.history) throw new Error("Could not read conversation history.");
    }

    if (!chrome.runtime?.id) {
      showOverlay("Extension reloaded", "Please refresh this LinkedIn tab to reconnect.");
      return;
    }

    const response = await chrome.runtime.sendMessage(payload);
    if (!response?.success) throw new Error(response?.error || "Unknown error");

    if (action === "summarizePost") {
      showOverlay("Summary", response.data);
    } else if (action === "rewritePost") {
      setEditorText(contextNode, response.data);
    } else {
      setEditorText(contextNode, response.data);
    }
  } catch (err) {
    console.error("[LinkedIn AI]", err);
    showOverlay("Error", err.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}


// ===== Helpers =====
function createButton(text, className) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.innerText = text;
  btn.style.cssText =
    "border-radius:16px;padding:5px 12px;font-weight:600;cursor:pointer;" +
    "border:1px solid #0a66c2;background:#fff;color:#0a66c2;font-size:14px;margin-right:5px;";
  return btn;
}

function findPostText(node) {
  // 1. Try known container selectors first (URN-based first; they're most stable).
  const known =
    node.closest('[data-urn^="urn:li:activity"]') ||
    node.closest('[data-id^="urn:li:activity"]') ||
    node.closest(".feed-shared-update-v2") ||
    node.closest(".occludable-update") ||
    node.closest("article") ||
    node.closest('[role="article"]');
  if (known) {
    const text = extractTextFromPost(known);
    if (text) return text;
  }

  // 2. Fallback: walk up from the editor. Find the nearest ancestor whose own
  //    text content is substantial (>40 chars) but not the whole document.
  //    This handles LinkedIn DOM renames without needing to track class names.
  let cur = node.parentElement;
  let bestText = null;
  for (let depth = 0; cur && cur !== document.body && depth < 25; depth++, cur = cur.parentElement) {
    const t = cur.innerText?.trim();
    if (t && t.length > 40 && t.length < 5000) {
      bestText = t;
      // Keep walking — we want the LARGEST container that's still bounded,
      // which is usually the post wrapper.
    } else if (t && t.length >= 5000) {
      break;
    }
  }
  if (bestText) {
    console.log("[LinkedIn AI] post text via walk-up fallback, len=", bestText.length);
    return bestText.substring(0, 1500);
  }

  console.warn("[LinkedIn AI] could not find any post text near editor", node);
  return null;
}

function extractTextFromPost(post) {
  const textNode =
    post.querySelector(".update-components-text") ||
    post.querySelector(".feed-shared-update-v2__description") ||
    post.querySelector(".feed-shared-update-v2__commentary") ||
    post.querySelector(".update-components-update-v2__commentary") ||
    post.querySelector(".feed-shared-text") ||
    post.querySelector(".feed-shared-inline-show-more-text") ||
    post.querySelector('span[dir="ltr"]');
  if (textNode) {
    const text = textNode.innerText.trim();
    if (text.length >= 2) return text;
  }
  const fallback = post.innerText?.trim();
  return fallback && fallback.length >= 2 ? fallback.substring(0, 1500) : null;
}

function findParentComment(node) {
  const comment = node.closest(".comments-comment-item");
  if (!comment) return null;
  const text = comment.querySelector(".comments-comment-item__main-content");
  return text ? text.innerText : null;
}

function findMessageHistory(node) {
  const msgWindow =
    node.closest(".msg-convo-wrapper") ||
    node.closest(".msg-overlay-conversation-bubble") ||
    document.querySelector(".msg-s-message-list-container");
  if (!msgWindow) return null;

  const messages = msgWindow.querySelectorAll(
    ".msg-s-event-listitem__body, .msg-s-message-group__body, .msg-s-event-listitem__message-bubble"
  );
  if (messages.length === 0) return null;

  const start = Math.max(0, messages.length - 5);
  let out = "";
  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    const isMine =
      msg.closest(".msg-s-message-group--is-mine") ||
      msg.closest(".msg-s-event-listitem--me");
    out += `${isMine ? "Me" : "Them"}: ${msg.innerText.trim()}\n`;
  }
  return out;
}

// One-shot text insertion. Replaces the per-character typing loop.
// We still use document.execCommand("insertText") because Quill/contenteditable
// editors on LinkedIn react reliably to it; the modern InputEvent replacement
// is not consistently honored by Quill yet.
function setEditorText(editor, text) {
  if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
    editor.value = text;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  editor.focus();

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.addRange(range);
  }

  // Single insert; replaces the prior char-by-char loop. Saves ~1–3s per
  // generation and avoids stressing the editor's reactivity layer.
  document.execCommand("insertText", false, text);
}

function showOverlay(title, body) {
  document.querySelector(".ai-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "ai-overlay";

  const card = document.createElement("div");
  card.className = "ai-overlay-card";

  const header = document.createElement("div");
  header.className = "ai-overlay-header";
  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ai-overlay-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  header.append(titleEl, closeBtn);

  const bodyEl = document.createElement("div");
  bodyEl.className = "ai-overlay-body";
  bodyEl.textContent = body;

  card.append(header, bodyEl);
  overlay.appendChild(card);

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  const onKey = (e) => { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
}
