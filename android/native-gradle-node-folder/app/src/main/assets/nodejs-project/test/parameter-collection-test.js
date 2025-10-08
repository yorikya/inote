const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { withIsolatedServer, createWebSocketConnection, waitForMessageType, waitForNonCommandMessage, sendMessage, clearMessageQueue } = require('./test-utils');

// Helper functions - sendMessage is now imported from test-utils

// waitForMessageType is now imported from test-utils

function waitForMessageSequence(ws, messageTypes, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for messages: ${messageTypes.join(', ')}`));
    }, timeout);

    const receivedMessages = [];
    const messageHandler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        receivedMessages.push(message.type);
        
        // Check if we have all required message types
        const hasAllMessages = messageTypes.every(type => receivedMessages.includes(type));
        if (hasAllMessages) {
          clearTimeout(timeoutId);
          ws.removeListener('message', messageHandler);
          resolve(receivedMessages);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    ws.on('message', messageHandler);
  });
}

function cleanupTestData() {
  const notesFile = path.join(__dirname, '../notes.parameter-collection-test.json');
  if (fs.existsSync(notesFile)) {
    fs.writeFileSync(notesFile, '{"notes": [], "latestNoteId": 0}');
    console.log('Cleaned up notes.parameter-collection-test.json');
  }
}

async function withServer(testFn) {
  await withIsolatedServer('parameter-collection-test', async (port) => {
    const ws = await createWebSocketConnection(port);
    try {
      await testFn(ws);
    } finally {
      ws.close();
    }
  }, { timeout: 30000 });
}

// Test functions
async function testCreatenoteParameterCollection(ws) {
  console.log('--- Testing /createnote parameter collection ---');
  
  const timestamp = Date.now();
  const uniqueTitle = `Test Note Param ${timestamp}`;
  
        // Test 1: /createnote without parameters should ask for title
        console.log('--- Step 1: Sending /createnote without parameters ---');
        sendMessage(ws, 'chat', { text: '/createnote' });
        console.log('--- Sent /createnote command, waiting for parameter prompt ---');
        
        // Wait for the specific reply message, ignoring available_commands
        let reply1;
        do {
            reply1 = await waitForMessageType(ws, 'reply');
            console.log('--- Got reply message:', JSON.stringify(reply1, null, 2));
        } while (!reply1.text.includes('Please provide a title for the note:'));
        
        console.log('--- Got parameter prompt:', reply1.text);
        assert(reply1.text.includes('Please provide a title for the note:'), 
            `Expected parameter prompt, got: ${reply1.text}`);
  
  // Test 2: Provide title should proceed to confirmation
  console.log('--- Step 2: Providing title:', uniqueTitle);
  sendMessage(ws, 'chat', { text: uniqueTitle });
  console.log('--- Sent title, waiting for confirmation prompt ---');
  
  // Wait for the specific confirmation reply message, ignoring available_commands
  let reply2;
  do {
    reply2 = await waitForMessageType(ws, 'reply');
    console.log('--- Got reply message:', JSON.stringify(reply2, null, 2));
  } while (!reply2.text.includes('Do you want to create a note with title'));
  
  console.log('--- Got confirmation prompt:', reply2.text);
  assert(reply2.text.includes('Do you want to create a note with title'), 
    `Expected confirmation prompt, got: ${reply2.text}`);
  
  // Test 3: Confirm should create the note
  console.log('--- Step 3: Confirming note creation ---');
  sendMessage(ws, 'chat', { text: 'yes' });
  console.log('--- Sent yes, waiting for created_note ---');
  
  const createdNote = await waitForMessageType(ws, 'created_note');
  console.log('--- Got created_note:', JSON.stringify(createdNote, null, 2));
  assert(createdNote.note && createdNote.note.title === uniqueTitle, 
    'Note should be created with correct title');
  
  const reply3 = await waitForMessageType(ws, 'reply');
  console.log('--- Got final reply:', JSON.stringify(reply3, null, 2));
  assert(reply3.text.includes('Note created successfully'), 
    `Expected success message, got: ${reply3.text}`);
  
  console.log('✓ /createnote parameter collection working');
}

async function testFindnoteParameterCollection(ws) {
  console.log('--- Testing /findnote parameter collection ---');
  
  const timestamp = Date.now();
  const uniqueQuery = `Test Query ${timestamp}`;
  
  // Test 1: /findnote without parameters should ask for query
  sendMessage(ws, 'chat', { text: '/findnote' });
  
  const reply1 = await waitForMessageType(ws, 'reply');
  assert(reply1.text.includes('Please provide a search query to find notes:'), 
    `Expected parameter prompt, got: ${reply1.text}`);
  
  // Test 2: Provide query should search for notes
  sendMessage(ws, 'chat', { text: uniqueQuery });
  
  // Wait for found_notes message first
  const foundNotes = await waitForMessageType(ws, 'found_notes');
  assert(Array.isArray(foundNotes.notes), 'Should return notes array');
  
  // Then wait for reply message
  const reply2 = await waitForMessageType(ws, 'reply');
  assert(reply2.text.includes('No notes have been found') || reply2.text.includes('Found'), 
    `Expected search result message, got: ${reply2.text}`);
  
  console.log('✓ /findnote parameter collection working');
}

async function testFindbyidParameterCollection(ws) {
  console.log('--- Testing /findbyid parameter collection ---');
  
  const timestamp = Date.now();
  const uniqueId = `999${timestamp}`;
  
  // Test 1: /findbyid without parameters should ask for ID
  sendMessage(ws, 'chat', { text: '/findbyid' });
  
  const reply1 = await waitForMessageType(ws, 'reply');
  assert(reply1.text.includes('Please provide a note ID to find:'), 
    `Expected parameter prompt, got: ${reply1.text}`);
  
  // Test 2: Provide invalid ID should return not found
  sendMessage(ws, 'chat', { text: uniqueId });
  
  // Wait for reply message (no found_notes message when note not found)
  const reply2 = await waitForMessageType(ws, 'reply');
  assert(reply2.text.includes('Note not found'), 
    `Expected not found message, got: ${reply2.text}`);
  
  console.log('✓ /findbyid parameter collection working');
}

async function testParameterCollectionCancel(ws) {
  console.log('--- Testing parameter collection cancel ---');
  
  // Start parameter collection
  sendMessage(ws, 'chat', { text: '/createnote' });
  await waitForMessageType(ws, 'reply'); // Wait for parameter prompt
  
  // Cancel the command
  sendMessage(ws, 'chat', { text: 'cancel' });
  
  const reply = await waitForMessageType(ws, 'reply');
  assert(reply.text.includes('Command cancelled'), 
    `Expected cancel message, got: ${reply.text}`);
  
  console.log('✓ Parameter collection cancel working');
}

async function testParameterCollectionHelp(ws) {
  console.log('--- Testing parameter collection help ---');
  
  // Start parameter collection
  sendMessage(ws, 'chat', { text: '/findnote' });
  await waitForMessageType(ws, 'reply'); // Wait for parameter prompt
  
  // Request help
  sendMessage(ws, 'chat', { text: 'help' });
  
  const reply = await waitForMessageType(ws, 'reply');
  assert(reply.text.includes('Help:') && reply.text.includes('Please provide a search query'), 
    `Expected help message, got: ${reply.text}`);
  
  console.log('✓ Parameter collection help working');
}

async function testParameterCollectionCommands(ws) {
  console.log('--- Testing parameter collection commands ---');
  
  // Start parameter collection
  sendMessage(ws, 'chat', { text: '/createnote' });
  await waitForMessageType(ws, 'reply'); // Wait for parameter prompt
  
  // Request available commands
  sendMessage(ws, 'get_commands');
  
  const commands = await waitForMessageType(ws, 'available_commands');
  assert(Array.isArray(commands.commands), 'Should return commands array');
  
  // Should have cancel and help commands
  const commandNames = commands.commands.map(cmd => cmd.command);
  assert(commandNames.includes('cancel'), 'Should have cancel command');
  assert(commandNames.includes('help'), 'Should have help command');
  
  console.log('✓ Parameter collection commands working');
}

async function testFullCreatenoteFlow(ws) {
  console.log('--- Testing full /createnote flow ---');
  
  const timestamp = Date.now();
  const uniqueTitle = `Shopping List ${timestamp}`;
  
  // Step 1: Start without parameters
  sendMessage(ws, 'chat', { text: '/createnote' });
  const step1 = await waitForMessageType(ws, 'reply');
  assert(step1.text.includes('Please provide a title'), 'Step 1: Should ask for title');
  
  // Step 2: Provide title
  sendMessage(ws, 'chat', { text: uniqueTitle });
  const step2 = await waitForMessageType(ws, 'reply');
  assert(step2.text.includes(`Do you want to create a note with title '${uniqueTitle}'`), 
    'Step 2: Should ask for confirmation');
  
  // Step 3: Confirm
  sendMessage(ws, 'chat', { text: 'yes' });
  const step3a = await waitForMessageType(ws, 'created_note');
  const step3b = await waitForMessageType(ws, 'reply');
  
  assert(step3a.note && step3a.note.title === uniqueTitle, 'Step 3a: Should create note');
  assert(step3b.text.includes('Note created successfully'), 'Step 3b: Should show success message');
  
  console.log('✓ Full /createnote flow working');
}

// Main test runner
async function runParameterCollectionTests() {
  console.log('🧪 Starting parameter collection tests...\n');
  
  const tests = [
    testCreatenoteParameterCollection,
    testFindnoteParameterCollection,
    testFindbyidParameterCollection,
    testParameterCollectionCancel,
    testParameterCollectionHelp,
    testParameterCollectionCommands,
    testFullCreatenoteFlow
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await withServer(test);
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Parameter Collection Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('🎉 All parameter collection tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

// Helper assertion function
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Run tests
if (require.main === module) {
  runParameterCollectionTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runParameterCollectionTests };
