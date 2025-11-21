// DOM Elements
const providerSelect = document.getElementById('provider');
const geminiConfig = document.getElementById('gemini-config');
const ollamaConfig = document.getElementById('ollama-config');
const apiKeyInput = document.getElementById('apiKey');
const ollamaUrlInput = document.getElementById('ollamaUrl');
const ollamaModelInput = document.getElementById('ollamaModel');
const webhookUrlInput = document.getElementById('webhookUrl');
const enableGmailInput = document.getElementById('enableGmail');
const forceLocalGmailInput = document.getElementById('forceLocalGmail');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const statusDiv = document.getElementById('status');

// Default Settings
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_MODEL = 'llava';

// Toggle config sections based on provider
providerSelect.addEventListener('change', () => {
  if (providerSelect.value === 'gemini') {
    geminiConfig.classList.remove('hidden');
    ollamaConfig.classList.add('hidden');
  } else {
    geminiConfig.classList.add('hidden');
    ollamaConfig.classList.remove('hidden');
  }
});

// Save Settings
saveButton.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const ollamaUrl = ollamaUrlInput.value.trim() || DEFAULT_OLLAMA_URL;
  const ollamaModel = ollamaModelInput.value.trim() || DEFAULT_OLLAMA_MODEL;
  const webhookUrl = webhookUrlInput.value.trim();
  const enableGmail = enableGmailInput.checked;
  const forceLocalGmail = forceLocalGmailInput.checked;

  // Validation
  if (provider === 'gemini' && !apiKey) {
    showStatus('Please enter a valid Gemini API key.', 'error');
    return;
  }

  if (provider === 'ollama') {
     if (!ollamaUrl) {
        showStatus('Please enter a valid Ollama URL.', 'error');
        return;
     }
     if (!ollamaModel) {
        showStatus('Please enter a valid Model name.', 'error');
        return;
     }
  }

  if (webhookUrl && !webhookUrl.startsWith('http')) {
      showStatus('Webhook URL must start with http:// or https://', 'error');
      return;
  }

  const settings = {
    aiProvider: provider,
    geminiApiKey: apiKey,
    ollamaUrl: ollamaUrl,
    ollamaModel: ollamaModel,
    reportingWebhookUrl: webhookUrl,
    enableGmail: enableGmail,
    forceLocalGmail: forceLocalGmail
  };

  try {
    await chrome.storage.local.set(settings);
    showStatus('Settings saved successfully.', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
    console.error('Error saving settings:', error);
  }
});

// Clear Settings
clearButton.addEventListener('click', async () => {
  try {
    await chrome.storage.local.clear();
    // Reset UI to defaults
    providerSelect.value = 'gemini';
    apiKeyInput.value = '';
    ollamaUrlInput.value = DEFAULT_OLLAMA_URL;
    ollamaModelInput.value = DEFAULT_OLLAMA_MODEL;
    webhookUrlInput.value = '';
    enableGmailInput.checked = false;
    forceLocalGmailInput.checked = true;

    geminiConfig.classList.remove('hidden');
    ollamaConfig.classList.add('hidden');

    showStatus('All settings cleared.', 'success');
  } catch (error) {
    showStatus('Error clearing settings: ' + error.message, 'error');
  }
});

// Load Settings on Start
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await chrome.storage.local.get([
        'aiProvider',
        'geminiApiKey',
        'ollamaUrl',
        'ollamaModel',
        'reportingWebhookUrl',
        'enableGmail',
        'forceLocalGmail'
    ]);

    if (result.aiProvider) {
      providerSelect.value = result.aiProvider;
    }

    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }

    if (result.ollamaUrl) {
      ollamaUrlInput.value = result.ollamaUrl;
    }

    if (result.ollamaModel) {
      ollamaModelInput.value = result.ollamaModel;
    }

    if (result.reportingWebhookUrl) {
        webhookUrlInput.value = result.reportingWebhookUrl;
    }

    // Checkbox logic: default is false, so only set if true
    if (result.enableGmail) {
        enableGmailInput.checked = result.enableGmail;
    }

    // Default is true for forceLocal, but storage might say false
    if (result.forceLocalGmail !== undefined) {
        forceLocalGmailInput.checked = result.forceLocalGmail;
    } else {
        forceLocalGmailInput.checked = true; // Default on
    }

    // Trigger change event to set initial visibility
    providerSelect.dispatchEvent(new Event('change'));

  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings.', 'error');
  }
});

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = type;

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  }
}