// options.js
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  chrome.storage.sync.get(['privacyMode', 'modelName', 'apiKey'], (items) => {
    if (items.privacyMode) {
      document.querySelector(`input[name="privacy"][value="${items.privacyMode}"]`).checked = true;
    }
    if (items.modelName) {
      document.getElementById('modelName').value = items.modelName;
    }
    if (items.apiKey) {
      document.getElementById('apiKey').value = items.apiKey;
    }
  });

  // Save settings
  document.getElementById('save').addEventListener('click', () => {
    const privacyMode = document.querySelector('input[name="privacy"]:checked').value;
    const modelName = document.getElementById('modelName').value;
    const apiKey = document.getElementById('apiKey').value;

    chrome.storage.sync.set({ privacyMode, modelName, apiKey }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Settings saved.';
      setTimeout(() => status.textContent = '', 2000);
    });
  });

  // Test Ollama
  document.getElementById('testOllama').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.textContent = 'Testing connection...';

    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        status.textContent = 'Connection successful! Available models: ' + data.models.map(m => m.name).join(', ');
        status.style.color = 'green';
      } else {
        status.textContent = 'Connection failed: ' + response.statusText;
        status.style.color = 'red';
      }
    } catch (error) {
      status.textContent = 'Connection error: ' + error.message;
      status.style.color = 'red';
    }
  });
});
