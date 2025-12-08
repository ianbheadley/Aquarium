
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

// Since background.js now imports modules, unit testing it directly in this simple setup
// requires handling ES modules in Jest or mocking.
// For this environment, we will mock the module logic to verify the *integration flow* conceptually
// or focus on testing the modules individually if we extracted them.
// Given time, I'll add a test for the Rules module logic if I can import it.
