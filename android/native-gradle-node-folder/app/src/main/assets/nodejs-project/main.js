const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

// Create an HTML file
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Node.js Mobile App</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            text-align: center;
        }
        #response {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>Hello from Node.js Mobile!</h1>
    <button onclick="fetchData()">Get Server Response</button>
    <div id="response">Click the button to get server response</div>

    <script>
        function fetchData() {
            fetch('http://127.0.0.1:3000/api/hello')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('response').innerText = data;
                })
                .catch(error => {
                    document.getElementById('response').innerText = 'Error: ' + error.message;
                });
        }
    </script>
</body>
</html>
`;

// Save the HTML file
fs.writeFileSync(path.join(__dirname, 'index.html'), htmlContent);

const server = http.createServer((req, res) => {
    // Enable CORS for all routes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.url === '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(htmlContent);
    } 
    else if (req.url === '/api/hello') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Response from Node.js backend: ' + new Date().toISOString());
    }
    else {
        res.statusCode = 404;
        res.end('Not Found');
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    // Notify the Android app that the server is ready
    if (global.androidToast) {
        global.androidToast.show('Node.js server is running!');
    }
});
