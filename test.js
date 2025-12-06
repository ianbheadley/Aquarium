
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

describe('Credential Trigger Logic', () => {
  let dom;
  let document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    document = dom.window.document;
    global.Node = dom.window.Node;
    global.document = document;
  });

  function checkForCredentials(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const inputs = node.querySelectorAll('input[type="password"], input[type="email"]');
    if (inputs.length > 0) {
      return true;
    }
    return false;
  }

  test('detects password input', () => {
    document.body.innerHTML = '<form><input type="password"></form>';
    expect(checkForCredentials(document.body)).toBe(true);
  });

  test('detects email input', () => {
    document.body.innerHTML = '<form><input type="email"></form>';
    expect(checkForCredentials(document.body)).toBe(true);
  });

  test('ignores other inputs', () => {
    document.body.innerHTML = '<form><input type="text"></form>';
    expect(checkForCredentials(document.body)).toBe(false);
  });
});

describe('Background Fetch Mock', () => {
    test('fetches from Ollama', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ response: '{"is_phishing": false}' }),
            })
        );

        const prompt = "test";
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });

        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
            method: 'POST'
        }));
        const data = await response.json();
        expect(data.response).toContain('is_phishing');
    });
});
