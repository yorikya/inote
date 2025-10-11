
// Add CSS MIME type handling to the server

// Find the section where static files are served and ensure CSS files are handled
// This is typically in the HTTP server or file serving section

// If using a simple HTTP server, add:
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// When serving files, use the appropriate MIME type:
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}
