/**
 * LinkedIn AI Commenter - Background Script
 * Handles requests from content.js and calls Groq API via Cloudflare Worker
 */

// ===== CONFIGURATION =====
// Update these with your actual values from Cloudflare Worker
const WORKER_URL = "linkedin-ai-proxy.info-rana012.workers.dev";  // e.g., "linkedin-ai-proxy.info-rana012.workers.dev"
const EXTENSION_SECRET = "myapp-xK9q2-linkedin-2024";  // Must match EXTENSION_SECRET in Cloudflare worker

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateComment") {
    generateContent(
      request.parentComment ? "reply" : "comment",
      {
        postContent: request.postContent,
        parentComment: request.parentComment
      }
    )
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "summarizePost") {
    generateContent("summarize", { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "rewritePost") {
    generateContent("rewrite", { postContent: request.postContent })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "generateMessageReply") {
    generateContent("message", { history: request.history })
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Generate content by calling Groq API via Cloudflare Worker
 * @param {string} action - The action type: "comment", "reply", "summarize", "rewrite", or "message"
 * @param {object} context - Context data for the action
 */
async function generateContent(action, context) {
  // Validate configuration
  if (WORKER_URL === "YOUR_WORKER_URL_HERE" || EXTENSION_SECRET === "YOUR_EXTENSION_SECRET_HERE") {
    throw new Error("Worker URL or EXTENSION_SECRET not configured. Please update background.js with your Cloudflare Worker details.");
  }

  let prompt;

  // Build prompt based on action
  if (action === "comment") {
    prompt = context.postContent;
  } else if (action === "reply") {
    prompt = `Post: "${context.postContent}"\n\nComment to reply to: "${context.parentComment}"`;
  } else if (action === "summarize") {
    prompt = context.postContent;
  } else if (action === "rewrite") {
    prompt = context.postContent;
  } else if (action === "message") {
    prompt = context.history;
  } else {
    throw new Error(`Invalid action: ${action}`);
  }

  // Call Cloudflare Worker (Groq proxy)
  try {
    console.log(`Sending ${action} request to worker:`, WORKER_URL);

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Token": EXTENSION_SECRET
      },
      body: JSON.stringify({
        action: action,
        prompt: prompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Worker Error:", response.status, errorData);

      if (response.status === 401) {
        throw new Error("Authentication failed. Check your EXTENSION_SECRET in background.js.");
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${errorData.error || "Invalid parameters"}`);
      } else if (response.status === 500) {
        throw new Error(`Server error: ${errorData.error || "Worker configuration issue"}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${errorData.error || "Unknown error"}`);
      }
    }

    const result = await response.json();
    console.log("Worker Response:", result);

    // Extract the result from the response
    if (result.error) {
      throw new Error(result.error);
    }

    if (result.result) {
      return result.result.trim();
    }

    throw new Error("Unexpected response format from worker");

  } catch (error) {
    console.error("Generation failed:", error);
    throw new Error("Failed to generate content: " + error.message);
  }
}