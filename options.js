const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llava';

// Save options to chrome.storage
const saveOptions = () => {
  const endpoint = document.getElementById('ollamaEndpoint').value;
  const model = document.getElementById('ollamaModel').value;

  chrome.storage.local.set(
    { ollamaEndpoint: endpoint, ollamaModel: model },
    () => {
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      status.className = 'status success';
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 2000);
    }
  );
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