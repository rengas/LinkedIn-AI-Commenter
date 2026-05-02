// Default settings
const defaults = {
  enableComment: true,
  enableReply: true,
  enableSummarizer: true,
  enableRewrite: true
};

// Load settings on startup
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(defaults, (settings) => {
    document.getElementById('toggleComment').checked = settings.enableComment;
    document.getElementById('toggleReply').checked = settings.enableReply;
    document.getElementById('toggleSummarizer').checked = settings.enableSummarizer;
    document.getElementById('toggleRewrite').checked = settings.enableRewrite;
  });
});

// Save settings when toggles change
const toggles = ['toggleComment', 'toggleReply', 'toggleSummarizer', 'toggleRewrite'];
const keys = ['enableComment', 'enableReply', 'enableSummarizer', 'enableRewrite'];

toggles.forEach((id, index) => {
  document.getElementById(id).addEventListener('change', (e) => {
    const setting = {};
    setting[keys[index]] = e.target.checked;
    chrome.storage.local.set(setting);
  });
});

// Open the full settings page (settings.html) in a new tab.
document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
