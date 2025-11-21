
// --- Configuration ---
const CHECK_DELAY_MS = 2000; // Wait for email to render

// --- Banner Injection ---
function showWarningBanner(reason) {
  // Check if banner already exists
  if (document.getElementById('gmail-phishing-protector-banner')) return;

  // Find the email container to inject the banner.
  // In Gmail, usually the email body is inside a container with role="main" or specific classes.
  // The best place is often at the top of the email view.
  // Class '.nH' is common for containers, but generic.
  // We will try to find the specific email subject/header area.
  // A safer bet is 'h2[data-thread-perm-id]' parent or '.ha' (header).

  // Let's try to find the main email container.
  // The container that holds the subject usually has class 'ha'.
  const subjectHeader = document.querySelector('div.ha') || document.querySelector('h2');

  const banner = document.createElement('div');
  banner.id = 'gmail-phishing-protector-banner';
  banner.style.cssText = `
    background-color: #fef2f2;
    border: 1px solid #ef4444;
    color: #991b1b;
    padding: 16px;
    margin: 10px 20px;
    border-radius: 6px;
    font-family: 'Inter', sans-serif;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    position: relative;
  `;

  banner.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <div style="flex: 1;">
      <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #7f1d1d;">Potential Phishing Detected</h3>
      <p style="margin: 0; font-size: 14px; line-height: 1.5;">We believe this to be a phishing email.</p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #b91c1c;"><strong>Reason:</strong> ${reason}</p>
    </div>
    <button id="gpp-dismiss" style="background: transparent; border: none; color: #991b1b; cursor: pointer; font-size: 20px;">&times;</button>
  `;

  // Injection logic
  if (subjectHeader && subjectHeader.parentElement) {
      subjectHeader.parentElement.insertBefore(banner, subjectHeader.nextSibling);
  } else {
      // Fallback: Try to prepend to the main role="main"
      const main = document.querySelector('[role="main"]');
      if (main) {
          main.insertBefore(banner, main.firstChild);
      } else {
          // Absolute fallback (might be ugly but visible)
          document.body.prepend(banner);
      }
  }

  document.getElementById('gpp-dismiss').onclick = () => banner.remove();
}

// --- Scanning Logic ---
let lastCheckedUrl = '';

async function scanCurrentEmail() {
    // Only scan if we are looking at an individual email.
    // Gmail URLs for emails are usually like #inbox/ID or #category/ID
    const hash = window.location.hash;
    if (!hash || (!hash.includes('inbox/') && !hash.includes('category/') && !hash.includes('label/'))) {
        // Likely in list view or settings
        return;
    }

    if (window.location.href === lastCheckedUrl) {
        return;
    }

    console.log('GPP: New email view detected, initiating scan...');
    lastCheckedUrl = window.location.href;

    // Extract text content
    // '.a3s' is a common class for message bodies in Gmail
    // '.ii' is the wrapper
    let emailBodyText = '';
    const messageBodies = document.querySelectorAll('.a3s');
    messageBodies.forEach(el => {
        if (el.offsetParent !== null) { // Check visibility
             emailBodyText += el.innerText + '\n';
        }
    });

    if (!emailBodyText.trim()) {
        // Fallback if we can't find specific class, grab the main visible text
        const main = document.querySelector('[role="main"]');
        if (main) emailBodyText = main.innerText;
    }

    // Send to background
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'analyze_email',
            text: emailBodyText.substring(0, 2000) // Limit text to avoid token limits if massive
        });

        if (response && response.isPhishing) {
            showWarningBanner(response.reason);
        }
    } catch (err) {
        console.error('GPP: Error communicating with background script:', err);
    }
}

// --- Observer ---
// We use a MutationObserver to detect when the URL changes or the DOM settles.
// Gmail is an SPA, so simple URL listeners might not catch everything, but hash changes trigger.

let scanTimeout;
const observer = new MutationObserver(() => {
    // Debounce the scan
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanCurrentEmail, CHECK_DELAY_MS);
});

observer.observe(document.body, { childList: true, subtree: true });

// Also listen for hash changes specifically
window.addEventListener('hashchange', () => {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanCurrentEmail, CHECK_DELAY_MS);
});

console.log('Gmail Phishing Protector: Content script loaded.');
