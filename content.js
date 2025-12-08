// content.js - Credential Trigger & Shield

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

// Shield Logic
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showShield') {
    createShield(message.reason, message.confidence);
  }
});

function createShield(reason, confidence) {
  if (document.getElementById('aquarium-shield-host')) return;

  const host = document.createElement('div');
  host.id = 'aquarium-shield-host';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100vw';
  host.style.height = '100vh';
  host.style.zIndex = '2147483647'; // Max z-index
  host.style.pointerEvents = 'auto';

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(220, 38, 38, 0.95);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      font-weight: 800;
    }
    p {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      max-width: 600px;
      line-height: 1.4;
    }
    .reason {
      background: rgba(0,0,0,0.2);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      font-family: monospace;
    }
    .actions {
      display: flex;
      gap: 1rem;
    }
    button {
      padding: 1rem 2rem;
      font-size: 1.2rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: transform 0.1s;
    }
    button:active {
      transform: scale(0.98);
    }
    .btn-escape {
      background: white;
      color: #dc2626;
    }
    .btn-trust {
      background: transparent;
      border: 2px solid white;
      color: white;
    }
  `;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  // Create elements safely
  const title = document.createElement('h1');
  title.textContent = '⚠️ Phishing Suspected';

  const msg = document.createElement('p');
  msg.textContent = 'Aquarium has detected potential phishing activity on this page.';

  const reasonBox = document.createElement('div');
  reasonBox.className = 'reason';

  const reasonStrong = document.createElement('strong');
  reasonStrong.textContent = 'Reason: ';

  const reasonText = document.createTextNode(reason || 'Unknown');

  const br = document.createElement('br');

  const confStrong = document.createElement('strong');
  confStrong.textContent = 'Confidence: ';

  const confText = document.createTextNode(confidence ? (confidence * 100).toFixed(0) + '%' : 'N/A');

  reasonBox.appendChild(reasonStrong);
  reasonBox.appendChild(reasonText);
  reasonBox.appendChild(br);
  reasonBox.appendChild(confStrong);
  reasonBox.appendChild(confText);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const btnEscape = document.createElement('button');
  btnEscape.className = 'btn-escape';
  btnEscape.id = 'escape';
  btnEscape.textContent = 'Go Back (Recommended)';

  const btnTrust = document.createElement('button');
  btnTrust.className = 'btn-trust';
  btnTrust.id = 'trust';
  btnTrust.textContent = 'I Trust This Page';

  actions.appendChild(btnEscape);
  actions.appendChild(btnTrust);

  overlay.appendChild(title);
  overlay.appendChild(msg);
  overlay.appendChild(reasonBox);
  overlay.appendChild(actions);

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Event Listeners
  btnEscape.addEventListener('click', () => {
    window.history.back();
    setTimeout(() => window.close(), 500); // Fallback if history.back fails or is empty
  });

  btnTrust.addEventListener('click', () => {
    host.remove();
    // Ideally, send message to background to whitelist this URL
    chrome.runtime.sendMessage({ action: 'trustPage', url: window.location.href });
  });

  document.body.appendChild(host);

  // Lock scroll
  document.body.style.overflow = 'hidden';
}
