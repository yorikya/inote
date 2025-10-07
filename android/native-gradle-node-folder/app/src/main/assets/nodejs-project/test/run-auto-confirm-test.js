#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Start the server in the background
console.log('Starting server...');
const serverProcess = spawn('node', ['../min.js'], {
    env: { ...process.env, NODE_PORT: '30001' },
    cwd: __dirname,
    stdio: 'inherit'
});

// Wait for the server to start
setTimeout(() => {
    console.log('Running auto-confirmation test...');
    const testProcess = spawn('node', ['auto-confirm-test.js'], {
        env: { ...process.env, NODE_PORT: '30001' },
        cwd: __dirname,
        stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
        console.log(`Test process exited with code ${code}`);
        serverProcess.kill('SIGTERM');
        process.exit(code);
    });
}, 2000); // Wait 2 seconds for server to start
