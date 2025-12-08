// capture.js - Data Capture Handling

async function setupOffscreenDocument(path) {
  // Check if offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [path]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document
  if (chrome.offscreen) { // Check if API exists
      await chrome.offscreen.createDocument({
        url: path,
        reasons: ['BLOBS'],
        justification: 'Resize screenshot for AI analysis',
      });
  } else {
      console.warn("chrome.offscreen API not available.");
  }
}

export const Capture = {
  async captureScreenshot(tabId) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(tabId, { format: 'jpeg', quality: 80 });
        return dataUrl;
    } catch (e) {
        console.error("Screenshot failed:", e);
        return null;
    }
  },

  async resizeScreenshot(dataUrl) {
    if (!dataUrl) return null;

    await setupOffscreenDocument('offscreen.html');

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'resizeImage',
        dataUrl: dataUrl,
        targetWidth: 1024,
        targetHeight: 1024
      }, (response) => {
        if (chrome.runtime.lastError) {
             console.error("Resize failed:", chrome.runtime.lastError);
             resolve(dataUrl); // Fallback to original
        } else {
             resolve(response);
        }
      });
    });
  },

  async getPageContent(tabId) {
      // Execute script to get text content
      try {
          const result = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                  return {
                      title: document.title,
                      text: document.body.innerText.substring(0, 2000) // First 2000 chars
                  };
              }
          });
          return result[0].result;
      } catch (e) {
          console.error("Script execution failed:", e);
          return { title: '', text: '' };
      }
  }
};
