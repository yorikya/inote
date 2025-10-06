// Test Upload Server
// Minimal server to test the upload functionality

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/upload.html') {
        // Serve the upload page
        const uploadPath = path.join(__dirname, 'upload.html');
        fs.readFile(uploadPath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Upload page not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🔗 WebSocket client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received message:', data);
            
            if (data.type === 'upload_complete') {
                console.log('✅ Upload completion received:');
                console.log('   Note ID:', data.noteId);
                console.log('   Image Path:', data.imagePath);
                console.log('   Error:', data.error);
                
                // Send confirmation back
                ws.send(JSON.stringify({
                    type: 'upload_success',
                    message: 'Image uploaded successfully!'
                }));
            } else if (data.type === 'upload_file') {
                console.log('📁 File upload received:');
                console.log('   Note ID:', data.noteId);
                console.log('   Filename:', data.filename);
                console.log('   File size:', data.fileSize, 'bytes');
                console.log('   File type:', data.fileType);
                console.log('   Data length:', data.fileData ? data.fileData.length : 0);
                
                // Simulate file saving
                const imagePath = 'images/' + data.filename;
                console.log('💾 Simulating file save to:', imagePath);
                
                // Send success response
                ws.send(JSON.stringify({
                    type: 'upload_success',
                    imagePath: imagePath,
                    message: 'File uploaded and saved successfully!'
                }));
            }
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Start server
const PORT = 8080;
server.listen(PORT, () => {
    console.log('🚀 Test Upload Server running on port', PORT);
    console.log('📱 Upload page: http://localhost:' + PORT + '/upload.html?noteId=20');
    console.log('🔗 WebSocket: ws://localhost:' + PORT);
    console.log('');
    console.log('🧪 Test the upload flow:');
    console.log('1. Open the upload page in your browser');
    console.log('2. Select an image');
    console.log('3. Check the server logs for WebSocket messages');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});
