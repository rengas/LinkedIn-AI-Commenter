# 🤖 LinkedIn AI Commenter - Chrome Extension

> **Supercharge your LinkedIn engagement with AI-powered comments, replies, and post improvements!**

---

## 🌟 Overview

**LinkedIn AI Commenter** is a Chrome extension that uses Google's Gemini AI to help you engage more effectively on LinkedIn. It generates human-like comments, replies, post summaries, and even rewrites your posts to make them more engaging - all with a single click!

### Why Use This Extension?

- ⏱️ **Save Time**: Generate thoughtful comments in seconds
- 🎯 **Stay Relevant**: AI analyzes post content to create contextual responses
- 💡 **Sound Smart**: Get unique perspectives and insights
- 🚀 **Boost Engagement**: Increase your LinkedIn presence effortlessly
- 🔒 **Secure**: Your API key stays safe on Cloudflare's servers

---

## ✨ Features

### 1. 💬 AI Comment Generation
Generate unique, human-like comments on any LinkedIn post that avoid generic phrases and add relevant questions.

### 2. 🔄 Smart Reply Assistant
Reply to comments with appreciation and added value, including extra insights and follow-up questions.

### 3. 📝 Post Summarizer
Get quick 3-5 bullet point summaries of long LinkedIn posts.

### 4. ✍️ Post Rewriter
Transform your draft posts into viral-worthy content with compelling hooks, better formatting, and relevant hashtags.

### 5. 💌 Smart Message Replies
Generate professional replies in LinkedIn messages based on conversation history.

---

## 🔧 How It Works

```
LinkedIn Page → Chrome Extension → Background Script → Cloudflare Worker → Google Gemini AI → Response
```

The extension uses a **Cloudflare Worker** as a secure proxy to keep your Google AI API key safe. The API key is stored on Cloudflare's servers, not in the extension where it could be extracted.

**Benefits:**
- 🔒 Security: API key never exposed
- 🌍 Fast: Cloudflare's global edge network
- 💰 Free: 100,000 requests/day
- 🛡️ Protected: CORS and request validation

---

## 📥 Installation

### Manual Installation (Developer Mode)

1. **Download the Extension**
   - Download this repository as ZIP and extract it

2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable **"Developer mode"** (top right)

3. **Load the Extension**
   - Click **"Load unpacked"**
   - Select the extension folder
   - Pin the extension icon (optional)

---

## 🚀 Setup Guide

### Quick Setup (4 Steps)

#### Step 1: Get Google AI API Key

1. Go to: **https://aistudio.google.com/app/apikey**
2. Sign in and click **"Create API Key"**
3. Copy the API key (starts with `AIza...`)

#### Step 2: Set Up Cloudflare Worker

1. Go to: **https://dash.cloudflare.com/sign-up** (create free account)
2. Navigate to **Workers & Pages** → **Create Worker**
3. Name it (e.g., `linkedin-ai-proxy`) and deploy
4. Click **"Edit Code"**, delete default code
5. Copy all code from `worker.js` and paste
6. Click **"Save and Deploy"**

#### Step 3: Add API Key to Worker

1. Go to **Settings** tab → **"Variables and Secrets"**
2. Click **"Add variable"**
3. Name: `GEMINI_API_KEY` (exactly this)
4. Value: Paste your API key
5. Click **"Encrypt"** and **"Save and Deploy"**
6. Copy your worker URL

#### Step 4: Update Extension

1. Open `manifest.json`, update line 18 with your worker URL
2. Open `background.js`, update line 123 with your worker URL
3. Go to `chrome://extensions/` and reload the extension
4. Test on LinkedIn!

**📖 Detailed Setup Instructions**: See [README-CLOUDFLARE-SETUP.md](README-CLOUDFLARE-SETUP.md)

---

## 📱 Usage

### On LinkedIn Feed

- **Comment**: Click "Add a comment" → Click **"✨ AI Comment"**
- **Reply**: Click "Reply" on any comment → Click **"✨ Assist Reply"**
- **Summarize**: Click **"📝 Summarize"** button on any post

### Creating Posts

1. Click "Start a post"
2. Write your draft
3. Click **"✨ Post Rewrite"**
4. Review and post!

### In Messages

1. Open any conversation
2. Click **"✨ Smart Reply"**
3. Review and send!

### Settings

Click the extension icon to toggle features on/off.

---

## 🏗️ Architecture

### File Structure

```
linkedin-ai-commenter/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (API calls)
├── content.js                 # Injects buttons on LinkedIn
├── styles.css                 # Button styling
├── options.html/js            # Settings page
├── worker.js                  # Cloudflare Worker code
├── README.md                  # Main documentation
└── README-CLOUDFLARE-SETUP.md # Detailed setup guide
```

### Components

1. **Content Script** (`content.js`): Detects LinkedIn elements and injects AI buttons
2. **Background Script** (`background.js`): Handles API calls and prompt construction
3. **Cloudflare Worker** (`worker.js`): Secure proxy that stores API key and calls Gemini
4. **Options Page**: Settings interface for toggling features

---

## ⚙️ Configuration

### Extension Settings

Access via extension icon. Toggle features:
- AI Comment ✅
- Smart Reply ✅
- Post Summarizer ✅
- Post Rewriter ✅

### Worker Configuration

Edit `worker.js` to customize:

**AI Model:**
```javascript
const GEMINI_MODEL = 'gemini-1.5-flash'; // Fast (default)
// or 'gemini-1.5-pro' for better quality
```

**Creativity:**
```javascript
temperature: 0.9, // 0.0 (focused) to 1.0 (creative)
```

---

## 🔒 Privacy & Security

### Data Collection

**None.** This extension does NOT:
- Collect personal data
- Track your activity
- Store LinkedIn content
- Send data to third parties (except Google Gemini API)

### What's Sent to Google?

Only content you explicitly request to process (post text, comments, drafts). Subject to [Google's Privacy Policy](https://policies.google.com/privacy).

### API Key Security

Your API key is:
- ✅ Stored on Cloudflare's secure servers
- ✅ Encrypted in environment variables
- ✅ Never exposed in extension code
- ✅ Protected by CORS policies

---

## 🔧 Troubleshooting

### Buttons Don't Appear
- Reload extension at `chrome://extensions/`
- Refresh LinkedIn page
- Check extension settings

### "Failed to connect to AI"
- Verify worker URL in `background.js` line 123
- Check worker is deployed in Cloudflare dashboard
- Test worker URL in browser

### "API key not configured"
- Verify variable name is exactly `GEMINI_API_KEY`
- Re-enter API key in worker settings
- Click "Save and Deploy"

### "Gemini API Error (400/401)"
- Verify API key at https://aistudio.google.com/app/apikey
- Enable API: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
- Check quota limits (15 req/min, 1,500/day)

**📖 More Solutions**: See [README-CLOUDFLARE-SETUP.md](README-CLOUDFLARE-SETUP.md#troubleshooting)

---

## ❓ FAQ

**Is this free?**
Yes! Google AI Studio (1,500 req/day) and Cloudflare Workers (100,000 req/day) are both free.

**Will I get banned from LinkedIn?**
No. You still review and post comments manually.

**Can I customize AI responses?**
Yes! Edit prompts in `background.js` lines 34-120.

**Does this work on mobile?**
No, Chrome extensions only work on desktop browsers.

**What's the difference between gemini-1.5-flash and pro?**
- **flash**: Faster, good quality (default)
- **pro**: Slower, excellent quality

---

## 🤝 Contributing

Contributions welcome! 
- Report bugs via Issues
- Suggest features
- Submit pull requests
- Improve documentation

---

## 📄 License

MIT License - See full license in repository.

---

## 🙏 Acknowledgments

- **Google Gemini AI**: Powerful AI model
- **Cloudflare**: Free Workers platform
- **You**: For using this extension!

---

## 🗺️ Roadmap

### Version 1.1
- Multiple AI providers (OpenAI, Claude)
- Custom prompt templates
- Keyboard shortcuts

### Version 2.0
- Analytics dashboard
- Tone selector
- Multi-language support

---

**Made with ❤️ for the LinkedIn community**

*Happy networking! 🚀*
