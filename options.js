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

  // Active persona dropdown
  chrome.storage.local.get(["personas", "activePersonaId"], ({ personas, activePersonaId }) => {
    const sel = document.getElementById('popupPersonaSelect');
    const row = document.getElementById('personaRow');
    if (!Array.isArray(personas) || personas.length <= 1) {
      // Hide the row when there's only one persona — no need to show a picker.
      if (row) row.style.display = 'none';
      return;
    }
    sel.innerHTML = '';
    personas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activePersonaId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', (e) => {
      chrome.storage.local.set({ activePersonaId: e.target.value });
    });
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
