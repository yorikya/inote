const { spawn } = require('child_process');

// Start the server in the background
console.log('Starting server...');
const serverProcess = spawn('node', ['../min.js'], {
    env: { ...process.env, NODE_PORT: '30002' },
    cwd: __dirname,
    stdio: 'inherit'
});

// Wait for the server to start
setTimeout(() => {
    console.log('Running basic operations test...');
    const testProcess = spawn('node', ['basic-operations-test.js'], {
        env: { ...process.env, NODE_PORT: '30002' },
        cwd: __dirname,
        stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
        console.log(`Test process exited with code ${code}`);
        serverProcess.kill();
        process.exit(code);
    });
}, 1000);
