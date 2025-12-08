// offscreen.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'resizeImage') {
    resizeImage(msg.dataUrl, msg.targetWidth, msg.targetHeight)
      .then(resizedDataUrl => sendResponse(resizedDataUrl))
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open
  }
});

function resizeImage(dataUrl, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
