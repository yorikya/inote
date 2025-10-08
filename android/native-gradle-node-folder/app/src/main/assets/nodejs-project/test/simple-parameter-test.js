const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Helper functions
function sendMessage(ws, type, data) {
  ws.send(JSON.stringify({ type, ...data }));
}

function waitForMessageType(ws, messageType, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${messageType} message`));
    }, timeout);

    const messageHandler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === messageType) {
          clearTimeout(timeoutId);
          ws.removeListener('message', messageHandler);
          resolve(message);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    ws.on('message', messageHandler);
  });
}

function cleanupTestData() {
  const notesFile = path.join(__dirname, '../notes.simple-parameter-test.json');
  if (fs.existsSync(notesFile)) {
    fs.writeFileSync(notesFile, '{"notes": [], "latestNoteId": 0}');
    console.log('Cleaned up notes.simple-parameter-test.json');
  }
}

async function withServer(testFn) {
  cleanupTestData();
  
  const port = 30000 + Math.floor(Math.random() * 1000);
  const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
    env: { ...process.env, NODE_PORT: port.toString(), NODE_ENV: 'test', TEST_SUITE: 'simple-parameter-test' },
    stdio: 'inherit'
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
      serverProcess.on('spawn', () => {
        setTimeout(resolve, 1000); // Give server time to start
        clearTimeout(timeout);
      });
    });

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await testFn(ws);
    
    ws.close();
  } finally {
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Test functions
async function testBasicParameterCollection(ws) {
  console.log('--- Testing basic parameter collection ---');
  
  // Test 1: /createnote without parameters should ask for title
  sendMessage(ws, 'chat', { text: '/createnote' });
  
  const reply1 = await waitForMessageType(ws, 'reply');
  console.log('Got reply:', reply1.text);
  
  if (reply1.text.includes('Please provide a title for the note:')) {
    console.log('✓ Parameter collection prompt working');
  } else {
    throw new Error(`Expected parameter prompt, got: ${reply1.text}`);
  }
  
  // Test 2: Cancel should work
  sendMessage(ws, 'chat', { text: 'cancel' });
  
  const reply2 = await waitForMessageType(ws, 'reply');
  console.log('Got cancel reply:', reply2.text);
  
  if (reply2.text.includes('Command cancelled')) {
    console.log('✓ Cancel functionality working');
  } else {
    throw new Error(`Expected cancel message, got: ${reply2.text}`);
  }
}

// Main test runner
async function runSimpleParameterTest() {
  console.log('🧪 Starting simple parameter collection test...\n');
  
  try {
    await withServer(testBasicParameterCollection);
    console.log('\n🎉 Simple parameter collection test passed!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  runSimpleParameterTest().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runSimpleParameterTest };
