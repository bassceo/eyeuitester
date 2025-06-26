import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const dynamic = 'force-dynamic'; // Force dynamic route handling

// Chromium options for better serverless compatibility
const getBrowserOptions = async (width: number, height: number, deviceScaleFactor: number) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Use local Chrome in development, Sparticuz in production
  const executablePath = isDev
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Update this path for your local Chrome
    : await chromium.executablePath();

  // Get Sparticuz Chromium args
  const args = [
    ...chromium.args,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ];

  return {
    args,
    defaultViewport: {
      width,
      height: Math.floor(height * 0.9),
      deviceScaleFactor,
      isMobile: width <= 768,
      hasTouch: width <= 1024,
    },
    executablePath: typeof executablePath === 'string' ? executablePath : await executablePath,
    headless: true,
    ignoreHTTPSErrors: true,
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const width = Math.min(parseInt(searchParams.get('width') || '1920'), 3840); // Max 4K width
  const height = Math.min(parseInt(searchParams.get('height') || '1080'), 2160); // Max 4K height
  const deviceScaleFactor = Math.min(parseFloat(searchParams.get('deviceScaleFactor') || '1'), 3); // Max 3x DPR

  if (!targetUrl) {
    return new Response('URL parameter is required', { status: 400 });
  }

  let browser;
  try {
    // Validate URL
    const url = new URL(targetUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return new Response('Invalid URL protocol', { status: 400 });
    }

    // Launch browser with Sparticuz Chromium
    const browserOptions = await getBrowserOptions(width, height, deviceScaleFactor);
    browser = await puppeteer.launch(browserOptions);

    const page = await browser.newPage();

    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set default navigation timeout
      page.setDefaultNavigationTimeout(60000);
      
      // Set default timeout for page operations
      page.setDefaultTimeout(30000);
      
      // Handle page errors
      page.on('pageerror', (error) => {
        console.error('Page error:', error);
      });

      // Handle console messages
      page.on('console', (msg) => {
        console.log('Browser console:', msg.text());
      });
      
      // Enable request interception to block unnecessary resources
      await page.setRequestInterception(true);
      
      page.on('request', (req) => {
        try {
          const resourceType = req.resourceType();
          // Block unnecessary resources to speed up loading
          if (['image', 'stylesheet', 'font', 'media', 'script'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        } catch (error) {
          console.error('Error in request interception:', error);
          req.abort();
        }
      });

      // Set viewport to match user's screen
      await page.setViewport({
        width,
        height: Math.min(800, 10000), // Start with a smaller height
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });

      // Set up viewport and navigation settings
      console.log(`Navigating to: ${targetUrl} with viewport ${width}x${height}`);
      
      // Set navigation timeout and ensure page is fully loaded
      await page.setDefaultNavigationTimeout(60000);
      
      try {
        // Set user agent based on device type
        const userAgent = width <= 768 
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        await page.setUserAgent(userAgent);
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
        });
        
        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });
        
        // Navigate to the page with retry logic
        let response = null;
        const maxRetries = 2;
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            response = await page.goto(targetUrl, {
              waitUntil: attempt === maxRetries ? 'domcontentloaded' : 'networkidle2',
              timeout: 30000,
            });
            
            if (response && response.ok()) break;
            
          } catch (error) {
            lastError = error;
            if (attempt === maxRetries) throw error;
            console.log(`Navigation attempt ${attempt + 1} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Wait for the page to be fully rendered
        await page.evaluate(async () => {
          // Ensure the page has some content
          if (document.body.children.length === 0) {
            throw new Error('Page has no content');
          }
          
          // Force a repaint to ensure content is rendered
          document.body.style.background = 'white';
          
          // Force layout and paint
          document.body.offsetHeight;
          
          // Scroll to trigger lazy loading
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for any lazy-loaded content
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error('Navigation error:', error);
        throw new Error(`Failed to load page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Wait for the page to be fully rendered with a timeout
      await Promise.race([
        page.waitForFunction(
          'document.readyState === "complete"',
          { timeout: 10000 }
        ).catch(() => console.log('Page load state check timeout')),
        new Promise(resolve => setTimeout(resolve, 3000)) // Wait at least 3 seconds
      ]);

      try {
        // Get the full page height
        const { fullHeight } = await page.evaluate(() => {
          // Scroll to the bottom to trigger lazy loading
          window.scrollTo(0, document.body.scrollHeight);
          return {
            fullHeight: Math.max(
              document.body.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.clientHeight,
              document.documentElement.scrollHeight,
              document.documentElement.offsetHeight
            ),
          };
        });

        // Set the viewport to the full page height
        await page.setViewport({
          width,
          height: Math.min(fullHeight, 10000), // Limit to prevent memory issues
          deviceScaleFactor: 1,
        });

        // Take screenshot of the full page
        console.log(`Taking screenshot of page (${width}x${fullHeight})`);
        const screenshot = await page.screenshot({
          type: 'jpeg',
          quality: 90,
          fullPage: true,
          captureBeyondViewport: true,
        });

        console.log('Screenshot captured successfully');
        
        // Return the screenshot as a response
        return new NextResponse(screenshot, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'X-Page-Height': fullHeight.toString(),
            'Cache-Control': 'no-store, max-age=0',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (screenshotError) {
        console.error('Error during screenshot capture:', screenshotError);
        throw new Error(`Screenshot capture failed: ${screenshotError instanceof Error ? screenshotError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error in page processing:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to process page',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error in screenshot capture:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to capture screenshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}
