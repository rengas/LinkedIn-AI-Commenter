
// Shared default settings for LinkedIn AI Commenter.
// Loaded by background.js via importScripts() and by settings.html via <script>.

const DEFAULT_PROVIDER = "ollama"; // "ollama" | "gemini" | "claude"

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const DEFAULT_PROMPTS = {
  comment:
    "You write thoughtful, professional LinkedIn comments. Given a post, write a short comment (1-3 sentences) that adds genuine value: a specific insight, a thoughtful question, or supportive engagement. Match the post's tone. Avoid generic praise like \"Great post!\" or \"Thanks for sharing!\". No hashtags. No quote marks around the output. Output only the comment text — nothing else.",

  reply:
    "You write LinkedIn replies. Given the original post and the comment you're replying to, write a short reply (1-2 sentences) that engages directly and specifically with what the commenter said. Be friendly and genuine. No hashtags. Output only the reply text — nothing else.",

  summarize:
    "Summarize the following LinkedIn post in 2-3 concise bullet points. Focus on the main point and any concrete takeaways. Output only the bullet points.",

  rewrite:
    "Rewrite the following LinkedIn post draft to be clearer, more engaging, and well-structured for LinkedIn. Keep the original message and intent. Preserve the author's voice. Use short paragraphs and a strong opening line. Output only the rewritten post text — nothing else.",

  message:
    "You help draft a reply in a LinkedIn direct message conversation. Given the recent message history (with \"Me\" and \"Them\" labels), write a short, natural, professional reply (1-3 sentences) from \"Me\" continuing the conversation. Output only the message text — nothing else."
};

const DEFAULT_FEATURE_TOGGLES = {
  enableComment: true,
  enableReply: true,
  enableSummarizer: true,
  enableRewrite: true
};

const ALL_DEFAULTS = {
  provider: DEFAULT_PROVIDER,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  geminiApiKey: "",
  geminiModel: DEFAULT_GEMINI_MODEL,
  claudeApiKey: "",
  claudeModel: DEFAULT_CLAUDE_MODEL,
  promptComment: DEFAULT_PROMPTS.comment,
  promptReply: DEFAULT_PROMPTS.reply,
  promptSummarize: DEFAULT_PROMPTS.summarize,
  promptRewrite: DEFAULT_PROMPTS.rewrite,
  promptMessage: DEFAULT_PROMPTS.message,
  ...DEFAULT_FEATURE_TOGGLES
};

// Expose for service worker (importScripts) — globals are fine here.
if (typeof self !== "undefined") {
  self.ALL_DEFAULTS = ALL_DEFAULTS;
  self.DEFAULT_PROMPTS = DEFAULT_PROMPTS;
}
