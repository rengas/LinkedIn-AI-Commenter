# 🤖 LinkedIn AI Commenter — Chrome Extension

> **Generate LinkedIn comments, replies, summaries, and post drafts with the AI of your choice — local Ollama, Google Gemini, or Anthropic Claude.**

---

## 🌟 Overview

**LinkedIn AI Commenter** is a Chrome extension that injects AI-powered buttons into LinkedIn for commenting, replying, summarizing posts, rewriting drafts, and replying in DMs. You choose the AI provider:

- **🖥️ Ollama (local)** — runs entirely on your machine, nothing leaves your computer
- **✨ Google Gemini API** — fast and inexpensive, uses your own API key
- **🧠 Anthropic Claude API** — high-quality writing, uses your own API key

You can also define multiple **personas** (e.g. "Personal" and "Company") so each LinkedIn account or voice can have its own set of system prompts. Switch persona from the popup before commenting.

---

## ✨ Features

| Feature | What it does |
|---|---|
| 💬 **Comment Assistant** | Generates a contextual comment for any post |
| 🔄 **Reply Assistant** | Drafts a reply that engages directly with a comment |
| 📝 **Post Summarizer** | Summarizes long posts into bullet points |
| ✍️ **Post Rewrite** | Polishes your draft post for clarity and engagement |
| 💌 **Smart DM Reply** | Drafts a reply to a LinkedIn direct message |
| 🎭 **Personas** | Multiple named prompt sets — switch voice in one click |
| 🔌 **Provider choice** | Local Ollama, Gemini API, or Claude API |

---

## 📥 Installation

1. Clone or download this repository.
2. Visit `chrome://extensions/` and enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the project folder.
4. Pin the extension icon for quick access.

---

## 🚀 Setup

Click the extension icon → **⚙️ Open Settings** to configure a provider.

### Option A — Ollama (local, free, private)

1. Install [Ollama](https://ollama.com).
2. Pull a model:
   ```
   ollama pull llama3.1:8b
   ```
3. Start Ollama with the extension origin allowed (required for CORS):
   ```
   OLLAMA_ORIGINS="chrome-extension://*" ollama serve
   ```
4. In Settings, pick **Ollama (local)**, set the URL (`http://localhost:11434`) and model (`llama3.1:8b`).
5. Click **Test connection**, then **Save**.

### Option B — Google Gemini

1. Get an API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. In Settings, pick **Google Gemini**, paste the key, set a model (default: `gemini-2.5-flash`).
3. Click **Test connection**, then **Save**.

### Option C — Anthropic Claude

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. In Settings, pick **Anthropic Claude**, paste the key, set a model (default: `claude-haiku-4-5-20251001`).
3. Click **Test connection**, then **Save**.

> API keys are stored locally in `chrome.storage.local`. They are sent only to the provider's API.

---

## 🎭 Personas

Each persona has its own set of five system prompts (comment, reply, summarize, rewrite, message). Useful when you switch between LinkedIn accounts (personal, company, side project).

In **Settings → Personas & prompts**:

- **+ New persona** — adds a persona seeded with the default prompts. Edit them to define the voice.
- **Rename** — change the label of the active persona.
- **Delete** — remove the active persona (you must keep at least one).
- **Active persona** dropdown — switching reloads its prompts into the editor.

The popup shows an **Active persona** dropdown when you have more than one persona — pick the right voice before clicking an AI button on LinkedIn.

---

## 📱 Usage on LinkedIn

- **Comment**: Click "Add a comment" on a post → click **✨ AI Comment**.
- **Reply**: Click "Reply" under any comment → click **✨ Assist Reply**.
- **Summarize**: Click **📝 Summarize** on a post.
- **Post draft**: Start a post, write a draft, click **✨ Post Rewrite**.
- **Direct message**: Open a conversation, click **✨ Smart Reply**.

Each feature can be toggled on/off from the popup.

---

## 🏗️ Architecture

```
LinkedIn page  →  content.js (injects buttons)
                       │
                       ▼
              background.js (service worker)
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Ollama        Gemini API     Claude API
   (localhost)    (Google)       (Anthropic)
```

### File structure

```
.
├── manifest.json              Extension config & host permissions
├── background.js              Service worker — routes to the chosen provider
├── content.js                 Injects AI buttons into LinkedIn
├── linkedin-probe-blocker.js  Blocks LinkedIn telemetry probes
├── defaults.js                Shared defaults & persona helpers
├── settings.html / settings.js   Full settings page
├── options.html / options.js     Toolbar popup (toggles + persona switch)
├── styles.css                 Button styling
└── rules.json                 declarativeNetRequest rules
```

---

## ⚙️ Configuration reference

| Setting | Stored as | Notes |
|---|---|---|
| Provider | `provider` | `"ollama"` \| `"gemini"` \| `"claude"` |
| Ollama URL / model | `ollamaUrl`, `ollamaModel` | Local server only |
| Gemini key / model | `geminiApiKey`, `geminiModel` | Sent to `generativelanguage.googleapis.com` |
| Claude key / model | `claudeApiKey`, `claudeModel` | Sent to `api.anthropic.com` |
| Personas | `personas` | Array of `{id, name, prompts}` |
| Active persona | `activePersonaId` | One of the persona IDs |
| Feature toggles | `enableComment`, `enableReply`, `enableSummarizer`, `enableRewrite` | |

All settings live in `chrome.storage.local` — they don't sync, leave the device, or get backed up to any server.

---

## 🔒 Privacy

- **Ollama**: requests stay on your machine. Nothing leaves localhost.
- **Gemini / Claude**: post or draft text you act on is sent to the provider's API, along with the system prompt of the active persona. API keys are sent in the request headers. The extension does not log, proxy, or telemetry-send anything.
- The extension does not collect analytics or read your LinkedIn profile, connections, or DMs unless you click an AI button on that specific item.

---

## 🔧 Troubleshooting

**Buttons don't appear on LinkedIn**
- Reload the extension at `chrome://extensions/` and refresh the LinkedIn tab.
- Check that the relevant feature toggle is on in the popup.

**Ollama: "Could not reach Ollama"**
- Confirm `ollama serve` is running.
- Confirm you started it with `OLLAMA_ORIGINS="chrome-extension://*"` — without this, the browser blocks the request as a CORS error.
- Confirm the model is pulled: `ollama list`.

**Gemini / Claude: "API key rejected (401/403)"**
- Re-copy the key from the provider console; whitespace can sneak in.
- For Gemini, verify the API is enabled for your Google project.
- For Claude, verify the key is active and has credit.

**Test connection succeeds but generation fails**
- The model name must match exactly (e.g. `gemini-2.5-flash`, `claude-haiku-4-5-20251001`).
- For Gemini, content may be blocked by safety filters on certain posts — try a different post or model.

---

## ❓ FAQ

**Is it free?**
Ollama is free and local. Gemini and Claude bill against your own API account; check each provider's pricing.

**Can I use multiple LinkedIn accounts?**
Yes — that's what personas are for. Create one persona per account/voice, write its prompts, and switch from the popup.

**Will I get banned from LinkedIn?**
The extension only injects UI; you still review and submit every comment yourself. As with any LinkedIn automation, use judgement.

**Does it work on mobile?**
No — Chrome extensions only run on desktop browsers.

**Where are my API keys stored?**
In `chrome.storage.local`, scoped to the extension. They are sent only to the provider you selected.

---

## 🤝 Contributing

Issues, feature ideas, and PRs are welcome.

---

## 📄 License

MIT — see the repository for the full license text.
