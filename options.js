document.getElementById('saveButton').addEventListener('click', async () => {
  const geminiApiKeyInput = document.getElementById('apiKey');
  const geminiApiKey = geminiApiKeyInput.value.trim();
  const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
  const anthropicApiKey = anthropicApiKeyInput.value.trim();
  const chatgptApiKeyInput = document.getElementById('chatgptApiKey');
  const chatgptApiKey = chatgptApiKeyInput.value.trim();
  const ollamaApiEndpointInput = document.getElementById('ollamaApiEndpoint');
  const ollamaApiEndpoint = ollamaApiEndpointInput.value.trim();
  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect.value;
  const statusDiv = document.getElementById('status');

  // Optional: Add more sophisticated validation based on selectedModel
  if (!geminiApiKey && selectedModel === 'gemini') {
    statusDiv.textContent = 'Please enter a Gemini API key to save when Gemini model is selected.';
    statusDiv.className = 'error';
    // return; // Decided to allow saving even if one key is missing for now
  }

  try {
    await chrome.storage.local.set({
      geminiApiKey: geminiApiKey,
      anthropicApiKey: anthropicApiKey,
      chatgptApiKey: chatgptApiKey,
      ollamaApiEndpoint: ollamaApiEndpoint,
      selectedModel: selectedModel
    });
    statusDiv.textContent = 'Settings saved successfully!';
    statusDiv.className = 'success';
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  } catch (error) {
    statusDiv.textContent = 'Error saving settings: ' + error.message;
    statusDiv.className = 'error';
    console.error('Error saving settings:', error);
  }
});

document.getElementById('clearButton').addEventListener('click', async () => {
  const geminiApiKeyInput = document.getElementById('apiKey');
  const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
  const chatgptApiKeyInput = document.getElementById('chatgptApiKey');
  const ollamaApiEndpointInput = document.getElementById('ollamaApiEndpoint');
  const statusDiv = document.getElementById('status');

  try {
    await chrome.storage.local.remove([
      'geminiApiKey',
      'anthropicApiKey',
      'chatgptApiKey',
      'ollamaApiEndpoint',
      // 'selectedModel' // Decided to keep selectedModel even when clearing keys
    ]);
    geminiApiKeyInput.value = '';
    anthropicApiKeyInput.value = '';
    chatgptApiKeyInput.value = '';
    ollamaApiEndpointInput.value = '';
    statusDiv.textContent = 'All API keys and endpoint cleared successfully!';
    statusDiv.className = 'success';
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  } catch (error) {
    statusDiv.textContent = 'Error clearing settings: ' + error.message;
    statusDiv.className = 'error';
    console.error('Error clearing settings:', error);
  }
});


// Load saved settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const keysToLoad = [
    'geminiApiKey',
    'selectedModel',
    'anthropicApiKey',
    'chatgptApiKey',
    'ollamaApiEndpoint'
  ];
  try {
    const result = await chrome.storage.local.get(keysToLoad);
    if (result.geminiApiKey) {
      document.getElementById('apiKey').value = result.geminiApiKey;
    }
    if (result.selectedModel) {
      document.getElementById('modelSelect').value = result.selectedModel;
    }
    if (result.anthropicApiKey) {
      document.getElementById('anthropicApiKey').value = result.anthropicApiKey;
    }
    if (result.chatgptApiKey) {
      document.getElementById('chatgptApiKey').value = result.chatgptApiKey;
    }
    if (result.ollamaApiEndpoint) {
      document.getElementById('ollamaApiEndpoint').value = result.ollamaApiEndpoint;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    statusDiv.textContent = 'Error loading saved settings.';
    statusDiv.className = 'error';
  }
});

// Save model selection on change
document.getElementById('modelSelect').addEventListener('change', async () => {
  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect.value;
  const statusDiv = document.getElementById('status');

  try {
    await chrome.storage.local.set({ selectedModel: selectedModel });
    statusDiv.textContent = 'Model selection saved!';
    statusDiv.className = 'success';
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 2000); // Shorter timeout for model selection
  } catch (error) {
    statusDiv.textContent = 'Error saving model selection: ' + error.message;
    statusDiv.className = 'error';
    console.error('Error saving model selection:', error);
  }
});