document.getElementById('saveButton').addEventListener('click', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiKey = apiKeyInput.value.trim();
  const statusDiv = document.getElementById('status');

  if (!apiKey) {
    statusDiv.textContent = 'Please enter a valid API key to save.';
    statusDiv.className = 'error';
    return;
  }

  try {
    await chrome.storage.local.set({ geminiApiKey: apiKey });
    statusDiv.textContent = 'API key saved successfully!';
    statusDiv.className = 'success';
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  } catch (error) {
    statusDiv.textContent = 'Error saving API key: ' + error.message;
    statusDiv.className = 'error';
    console.error('Error saving API key:', error);
  }
});

document.getElementById('clearButton').addEventListener('click', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const statusDiv = document.getElementById('status');

  try {
    await chrome.storage.local.remove('geminiApiKey');
    apiKeyInput.value = ''; // Clear the input field
    statusDiv.textContent = 'API key cleared successfully!';
    statusDiv.className = 'success';
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  } catch (error) {
    statusDiv.textContent = 'Error clearing API key: ' + error.message;
    statusDiv.className = 'error';
    console.error('Error clearing API key:', error);
  }
});


// Load saved API key on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await chrome.storage.local.get('geminiApiKey');
    if (result.geminiApiKey) {
      document.getElementById('apiKey').value = result.geminiApiKey;
    }
  } catch (error) {
    console.error('Error loading API key:', error);
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Error loading saved API key.';
    statusDiv.className = 'error';
  }
});