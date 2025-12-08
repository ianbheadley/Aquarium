
from playwright.sync_api import sync_playwright
import os

def verify_options_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local options.html file
        options_path = os.path.abspath('options.html')
        page.goto(f'file://{options_path}')

        # Verify title
        assert page.title() == 'Aquarium Options'

        # Verify sections
        assert page.is_visible('text=Privacy Mode')
        assert page.is_visible('text=Local AI Model (Ollama)')
        assert page.is_visible('text=Cloud Stub (Vertex AI)')

        # Verify Test Button
        assert page.is_visible('#testOllama')

        # Screenshot
        page.screenshot(path='verification/options_page.png')
        browser.close()

if __name__ == "__main__":
    verify_options_page()
