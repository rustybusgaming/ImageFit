import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(record_video_dir="/tmp/")
        page = await context.new_page()

        print("Navigating to app...")
        await page.goto("http://localhost:5173/ImageFit/")

        print("Uploading dummy video...")
        file_input = page.locator('input[type="file"]')
        await file_input.set_input_files('/tmp/flower.webm')

        print("Waiting for VideoSquisher component...")
        await page.wait_for_selector('text="Discord video compressor"')

        print("Capturing screenshot...")
        await page.screenshot(path="screenshot.png", full_page=True)
        print("Done.")

        await context.close()
        await browser.close()

asyncio.run(run())