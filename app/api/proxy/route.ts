export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get("url")

  if (!targetUrl) {
    return new Response("URL parameter is required", { status: 400 })
  }

  try {
    // Validate URL
    const url = new URL(targetUrl)
    if (!["http:", "https:"].includes(url.protocol)) {
      return new Response("Invalid URL protocol", { status: 400 })
    }

    // Fetch the target website
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })

    if (!response.ok) {
      return new Response(`Failed to fetch: ${response.status}`, { status: response.status })
    }

    let html = await response.text()

    // Modify HTML to prevent navigation and add base tag
    html = html.replace(
      /<head>/i,
      `<head>
        <base href="${url.origin}">
        <style>
          /* Prevent navigation */
          a { pointer-events: none !important; cursor: default !important; }
          form { pointer-events: none !important; }
          button[type="submit"] { pointer-events: none !important; }
          input[type="submit"] { pointer-events: none !important; }
        </style>
        <script>
          // Prevent all navigation
          document.addEventListener('click', function(e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);
          
          // Prevent form submissions
          document.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }, true);

          // Track scroll and send to parent
          let lastScrollY = 0;
          function trackScroll() {
            const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
            if (currentScrollY !== lastScrollY) {
              lastScrollY = currentScrollY;
              try {
                window.parent.postMessage({
                  type: 'scroll',
                  scrollY: currentScrollY
                }, '*');
              } catch(e) {
                console.log('PostMessage error:', e);
              }
            }
          }
          
          // Add scroll tracking when page loads
          window.addEventListener('load', function() {
            window.addEventListener('scroll', trackScroll, { passive: true });
            document.addEventListener('scroll', trackScroll, { passive: true });
            setInterval(trackScroll, 100);
            trackScroll(); // Initial call
          });
        </script>`,
    )

    // Fix relative URLs
    html = html.replace(/src="\/([^"]*)"/, `src="${url.origin}/$1"`)
    html = html.replace(/href="\/([^"]*)"/, `href="${url.origin}/$1"`)

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    })
  } catch (error) {
    console.error("Proxy error:", error)
    return new Response("Failed to proxy request", { status: 500 })
  }
}
