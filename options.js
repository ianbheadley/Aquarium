const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llava';

// Helpers
const showStatus = (message, type) => {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  if (type === 'success') {
    setTimeout(() => {
      status.textContent = '';
      status.className = 'status';
    }, 4000);
  }
};

// Save options to chrome.storage
const saveOptions = () => {
  const endpoint = document.getElementById('ollamaEndpoint').value;
  const model = document.getElementById('ollamaModel').value;

  chrome.storage.local.set(
    { ollamaEndpoint: endpoint, ollamaModel: model },
    () => {
      showStatus('Options saved.', 'success');
    }
  );
};

// Test connection to Ollama
const testConnection = async () => {
  const endpoint = document.getElementById('ollamaEndpoint').value || DEFAULT_ENDPOINT;
  const model = document.getElementById('ollamaModel').value || DEFAULT_MODEL;

  showStatus('Testing connection...', '');

  try {
    // 1. Test basic reachability
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) throw new Error(`Endpoint reachable but returned ${response.status}`);

    const data = await response.json();
    const models = data.models || [];
    const modelExists = models.some(m => m.name.includes(model));

    if (modelExists) {
        showStatus(`Success! Connected to Ollama and found model '${model}'.`, 'success');
    } else {
        showStatus(`Connected to Ollama, but model '${model}' not found in list.`, 'error');
    }

  } catch (error) {
    console.error(error);
    showStatus(`Connection failed: ${error.message}. Is Ollama running?`, 'error');
  }
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.local.get(
    { ollamaEndpoint: DEFAULT_ENDPOINT, ollamaModel: DEFAULT_MODEL },
    (items) => {
      document.getElementById('ollamaEndpoint').value = items.ollamaEndpoint;
      document.getElementById('ollamaModel').value = items.ollamaModel;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('testConnection').addEventListener('click', testConnection);
