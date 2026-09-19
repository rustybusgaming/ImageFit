import base64
from playwright.sync_api import sync_playwright

# Generate a 1x1 transparent PNG
pixel = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')
with open('/tmp/dummy.png', 'wb') as f:
    f.write(pixel)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto('http://localhost:5173/ImageFit/')

    # Need to upload an image to see the Platform Selector
    file_input = page.locator("input[type='file']")
    file_input.set_input_files('/tmp/dummy.png')

    # Wait for the platform sizes header to appear
    page.wait_for_selector('text=Social platform sizes')

    # Take a screenshot of the platform selector to verify the "Add" button
    page.locator('text=Social platform sizes').locator('..').locator('..').locator('..').screenshot(path='add_button.png')
    page.screenshot(path='full_page.png')

    browser.close()
