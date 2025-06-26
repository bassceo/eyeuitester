// sparticuz.config.js
module.exports = {
  // Automatically download the Chromium binary during build time
  // This ensures the binary is available in the deployment environment
  download: true,
  
  // Specify the path where the Chromium binary will be stored
  // This should match the path expected by @sparticuz/chromium
  path: 'node_modules/@sparticuz/chromium/bin',
  
  // Revision of Chromium to download
  // You can specify a specific version or use 'latest'
  revision: 'latest',
  
  // Whether to log download progress
  logLevel: 'info',
  
  // Additional arguments to pass to the Chromium instance
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  },
};
