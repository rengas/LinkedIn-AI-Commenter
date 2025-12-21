// Robust Injection Logic
const INJECTED_CLASS = "ai-btn-v10";

// Settings State
let settings = {
  enableComment: true,
  enableReply: true,
  enableSummarizer: true,
  enableRewrite: true
};

// Load Settings
chrome.storage.local.get(settings, (data) => {
  settings = data;
});

// Listen for updates
chrome.storage.onChanged.addListener((changes) => {
  for (let key in changes) {
    if (settings.hasOwnProperty(key)) {
      settings[key] = changes[key].newValue;
    }
  }
});

// 1. MAIN OBSERVER
const observer = new MutationObserver(() => {
  // Debounce slightly to avoid performance hits
  requestAnimationFrame(() => {
    injectCommentButtons();
    injectSummarizeButtons();
    injectImproveButtons();
    injectMessageButtons();
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// 2. FALLBACK POLLING (Ensures buttons appear even if observer misses)
setInterval(() => {
  injectCommentButtons();
  injectSummarizeButtons();
  injectImproveButtons();
  injectMessageButtons();
}, 2000);


// --- FEATURE 1: COMMENT BUTTONS ---
function injectCommentButtons() {
  // Select all text editors (comments, replies, messages)
  // LinkedIn uses role="textbox" consistently
  const editors = document.querySelectorAll('[role="textbox"], .ql-editor');

  editors.forEach(editor => {
    // Filter out search bars and non-comment inputs
    if (editor.getAttribute('aria-label')?.includes('Search')) return;
    if (editor.closest('.search-global-typeahead__input')) return;

    // Filter out the main post creation modal (handled by injectImproveButtons)
    if (editor.closest('.share-creation-state') || editor.closest('.share-box-v2')) return;

    // Filter out message inputs (handled by injectMessageButtons)
    if (editor.closest('.msg-form__contenteditable') || editor.closest('.msg-form__message-text-editor')) return;

    // Check injection
    const container = editor.closest('.comments-comment-box__form-container') ||
      editor.closest('form') ||
      editor.parentElement;

    if (!container || container.querySelector('.ai-generate-btn')) return;

    // Determine if it's a reply or a new comment
    // 1. Check if inside a comment item (replying to someone)
    const isInsideComment = editor.closest('.comments-comment-item') !== null;
    const isInsideReply = editor.closest('.comments-reply-item') !== null;

    // 2. Check submit button text
    const submitBtn = container.querySelector('.comments-comment-box__submit-button--primary') ||
      container.querySelector('button[type="submit"]') ||
      container.querySelector('.artdeco-button--primary');

    const submitText = submitBtn ? submitBtn.innerText.trim() : '';

    // 3. Check placeholder or aria-label
    const placeholder = editor.getAttribute('placeholder') || '';
    const ariaLabel = editor.getAttribute('aria-label') || '';
    const isReplyPlaceholder = placeholder.toLowerCase().includes('reply') || ariaLabel.toLowerCase().includes('reply');

    // It is a reply if we are inside a comment thread OR the button says "Reply" OR the placeholder says "Reply"
    const isReply = isInsideComment || isInsideReply || submitText === 'Reply' || isReplyPlaceholder;

    // CHECK SETTINGS
    if (isReply && !settings.enableReply) return;
    if (!isReply && !settings.enableComment) return;

    const btnText = isReply ? "✨ Assist Reply" : "✨ AI Comment";

    // CREATE BUTTON
    const btn = createButton(btnText, "ai-generate-btn");
    btn.style.marginTop = "5px";

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleGeneration(btn, editor, "generateComment");
    };

    // Inject
    // Wrapper for buttons to keep them together
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'inline-flex';
    btnContainer.style.gap = '8px';
    btnContainer.style.alignItems = 'center';
    btnContainer.className = "ai-btn-container"; // Add class for checking existence

    // 1. Main Button (Comment/Reply)
    btnContainer.appendChild(btn);

    if (submitBtn && submitBtn.parentElement) {
      // Inject AFTER the submit button
      submitBtn.parentElement.insertBefore(btnContainer, submitBtn.nextSibling);
      btnContainer.style.marginLeft = "8px";
    } else {
      // Fallback: Try to put it in the button bar
      const buttonBar = container.querySelector('.comments-comment-box__detour-icons') || container;
      if (buttonBar && buttonBar !== container) {
        buttonBar.parentElement.insertBefore(btnContainer, buttonBar.nextSibling);
      } else {
        container.appendChild(btnContainer);
      }
    }
  });
}


// --- FEATURE 2: SUMMARIZE BUTTONS ---
function injectSummarizeButtons() {
  if (!settings.enableSummarizer) return;

  // Find all posts
  const posts = document.querySelectorAll('.feed-shared-update-v2, .occludable-update');

  posts.forEach(post => {
    // Find the action bar (Like, Comment, etc.)
    const actionBar = post.querySelector('.feed-shared-social-action-bar');
    if (!actionBar || actionBar.querySelector('.ai-summarize-btn')) return;

    const btn = createButton("📝 Summarize", "ai-summarize-btn");
    btn.style.marginLeft = "8px";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.color = "#666";
    btn.style.fontWeight = "600";
    btn.style.cursor = "pointer";
    btn.style.padding = "8px";

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleGeneration(btn, post, "summarizePost");
    };

    actionBar.appendChild(btn);
  });
}


// --- FEATURE 3: IMPROVE POST BUTTONS ---
function injectImproveButtons() {
  if (!settings.enableRewrite) return;

  // Look for the main post creation modal
  const modal = document.querySelector('.share-creation-state');
  if (!modal) return;

  const editor = modal.querySelector('[role="textbox"]');
  if (!editor) return;

  // Find the footer area to inject the button
  const footer = modal.querySelector('.share-creation-state__bottom-container') ||
    modal.querySelector('.share-box-v2__bottom-container');

  if (!footer || footer.querySelector('.ai-rewrite-btn')) return;

  const btn = createButton("✨ Post Rewrite", "ai-rewrite-btn");
  btn.style.margin = "10px 0";

  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleGeneration(btn, editor, "rewritePost");
  };

  if (footer.firstChild) {
    footer.insertBefore(btn, footer.firstChild);
  } else {
    footer.appendChild(btn);
  }
}

// --- FEATURE 4: MESSAGE REPLY BUTTONS ---
function injectMessageButtons() {
  // Select message inputs
  const editors = document.querySelectorAll('.msg-form__contenteditable[role="textbox"], .msg-form__message-text-editor [role="textbox"]');

  editors.forEach(editor => {
    // Find the container (usually the form)
    const form = editor.closest('form');
    if (!form) return;

    // Find the Send button
    const sendBtn = form.querySelector('.msg-form__send-button');
    if (!sendBtn || sendBtn.parentElement.querySelector('.ai-msg-reply-btn')) return;

    // Create Button
    const btn = createButton("✨ Smart Reply", "ai-msg-reply-btn");
    btn.style.marginRight = "8px";
    btn.style.padding = "4px 10px";
    btn.style.fontSize = "12px";

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleGeneration(btn, editor, "generateMessageReply");
    };

    // Inject BEFORE the Send button
    sendBtn.parentElement.insertBefore(btn, sendBtn);
  });
}


// --- CORE LOGIC ---

async function handleGeneration(btn, contextNode, action) {
  const originalText = btn.innerText;
  btn.innerText = "⏳ Working...";
  btn.disabled = true;

  try {
    let postContent = "";
    let parentComment = null;
    let history = "";

    if (action === "generateComment") {
      postContent = findPostText(contextNode);
      parentComment = findParentComment(contextNode);
      if (!postContent) throw new Error("Could not find post text.");
    }
    else if (action === "summarizePost") {
      postContent = findPostText(contextNode); // contextNode is the post itself here
      if (!postContent) throw new Error("Could not find post text.");
    }
    else if (action === "rewritePost") {
      // contextNode is the editor (input box)
      postContent = contextNode.innerText || contextNode.value || contextNode.textContent;
      if (!postContent && contextNode.querySelector('p')) {
        postContent = contextNode.querySelector('p').innerText;
      }
      if (!postContent || postContent.trim().length < 2) {
        throw new Error("Please write some text to rewrite first.");
      }
    }
    else if (action === "generateMessageReply") {
      history = findMessageHistory(contextNode);
      if (!history) throw new Error("Could not read conversation history.");
    }

    // Send to Background
    if (!chrome.runtime?.id) {
      alert("Extension updated. Please refresh this page to reconnect.");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: action,
      postContent: postContent,
      parentComment: parentComment,
      history: history
    });

    if (!response.success) throw new Error(response.error);

    // Handle Result
    if (action === "summarizePost") {
      alert("📌 SUMMARY:\n\n" + response.data);
    } else if (action === "rewritePost") {
      // Replace content for Post Rewrite (uses value/innerText)
      if (contextNode.tagName === 'TEXTAREA' || contextNode.tagName === 'INPUT') {
        contextNode.value = response.data;
      } else {
        contextNode.innerText = response.data;
      }
      contextNode.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Comment AND Message Reply
      // Use typing simulation to trigger "Send" button enablement
      if (action === "generateMessageReply") {
        // Optional: Clear previous content if needed, but be careful not to break listeners
        // contextNode.innerText = "";
      }
      await simulateTyping(contextNode, response.data);
    }

  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function createButton(text, className) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.innerText = text;
  btn.style.borderRadius = "16px";
  btn.style.padding = "5px 12px";
  btn.style.fontWeight = "600";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid #0a66c2";
  btn.style.background = "#fff";
  btn.style.color = "#0a66c2";
  btn.style.fontSize = "14px";
  btn.style.marginRight = "5px";
  return btn;
}

function findPostText(node) {
  // Walk up to find the post container
  const post = node.closest('.feed-shared-update-v2') ||
    node.closest('.occludable-update') ||
    node.closest('article');

  if (!post) return null;

  // Try multiple selectors for the text
  const textNode = post.querySelector('.feed-shared-update-v2__description') ||
    post.querySelector('.feed-shared-text') ||
    post.querySelector('.update-components-text');

  return textNode ? textNode.innerText : post.innerText.substring(0, 500);
}

function findParentComment(node) {
  const comment = node.closest('.comments-comment-item');
  if (!comment) return null;

  const text = comment.querySelector('.comments-comment-item__main-content');
  return text ? text.innerText : null;
}

function findMessageHistory(node) {
  // 1. Find the message list container
  // Try multiple selectors for the conversation window
  const msgWindow = node.closest('.msg-convo-wrapper') ||
    node.closest('.msg-overlay-conversation-bubble') ||
    document.querySelector('.msg-s-message-list-container'); // Fallback to global active list

  if (!msgWindow) return null;

  // 2. Find all message bubbles
  // LinkedIn uses different classes for message bodies
  const messages = msgWindow.querySelectorAll('.msg-s-event-listitem__body, .msg-s-message-group__body, .msg-s-event-listitem__message-bubble');

  if (messages.length === 0) return null;

  // 3. Extract text from the last 5 messages
  let historyText = "";
  const maxMessages = 5;
  const start = Math.max(0, messages.length - maxMessages);

  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    // Determine sender: check for "mine" class in parent hierarchy
    const isMine = msg.closest('.msg-s-message-group--is-mine') ||
      msg.closest('.msg-s-event-listitem--me');

    const sender = isMine ? "Me" : "Them";
    historyText += `${sender}: ${msg.innerText.trim()}\n`;
  }

  return historyText;
}

async function simulateTyping(editor, text) {
  editor.focus();
  // Clear existing text if it's a message reply to avoid appending
  // We use execCommand 'delete' to respect the editor's state
  if (editor.innerText.trim().length > 0) {
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  }

  for (const char of text) {
    document.execCommand("insertText", false, char);
    await new Promise(r => setTimeout(r, 5 + Math.random() * 10)); // Faster typing
  }
}