import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const width = parseInt(searchParams.get('width') || '1920');

  if (!targetUrl) {
    return new Response('URL parameter is required', { status: 400 });
  }

  try {
    // Validate URL
    const url = new URL(targetUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return new Response('Invalid URL protocol', { status: 400 });
    }

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Set viewport to match user's screen width
      await page.setViewport({
        width,
        height: 800, // Initial height, will be adjusted
        deviceScaleFactor: 1,
      });

      // Navigate to the page
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000, // 30 seconds timeout
      });

      // Get the full page height
      const bodyHandle = await page.$('body');
      const { height } = await page.evaluate((body) => {
        // Scroll to the bottom to load all content
        window.scrollTo(0, document.body.scrollHeight);
        return {
          width: document.body.scrollWidth,
          height: document.body.scrollHeight,
        };
      }, bodyHandle);

      // Set the viewport to the full page height
      await page.setViewport({
        width,
        height: Math.min(height, 10000), // Limit to prevent memory issues
        deviceScaleFactor: 1,
      });

      // Take screenshot of the full page
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: true,
      });

      // Return the screenshot as a response
      return new NextResponse(screenshot, {
        headers: {
          'Content-Type': 'image/jpeg',
          'X-Page-Height': height.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Error taking screenshot:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to capture screenshot' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
