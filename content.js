// content.js - Credential Trigger

function checkForCredentials(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const inputs = node.querySelectorAll('input[type="password"], input[type="email"]');
  if (inputs.length > 0) {
    // Found credentials!
    console.log('Aquarium: Credential form detected!');

    // Find the nearest form or container
    let target = inputs[0].closest('form');
    if (!target) {
        // If no form tag, might be a div container. Use the input's parent or the input itself.
        target = inputs[0];
    }

    const rect = target.getBoundingClientRect();

    chrome.runtime.sendMessage({
      action: 'credentialDetected',
      url: window.location.href,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
        x: rect.x,
        y: rect.y
      }
    });
  }
}

// Initial check
checkForCredentials(document.body);

// Observer for dynamic changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      checkForCredentials(node);
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
