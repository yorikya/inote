const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// Simple test framework
function test(name, fn) {
    console.log(`Running: ${name}`);
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(error.message);
        process.exit(1);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Test server management
async function withServer(testFn) {
    // Use random port to avoid conflicts
    const port = 30000 + Math.floor(Math.random() * 1000);
    const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
        env: { ...process.env, NODE_PORT: port.toString(), NODE_ENV: 'test' },
        stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        await testFn(port);
    } finally {
        serverProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 100)); // Give it time to close
    }
}

// WebSocket test helper
async function withWebSocket(port, testFn) {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.setMaxListeners(20); // Increase max listeners to avoid warning

    await new Promise(resolve => {
        ws.on('open', resolve);
    });

    // Wait for connection message
    await new Promise(resolve => {
        ws.once('message', resolve);
    });

    try {
        await testFn(ws);
    } finally {
        // Wait a bit for any pending messages
        await new Promise(resolve => setTimeout(resolve, 100));
        ws.close();
        // Wait for the close event
        await new Promise(resolve => {
            ws.on('close', resolve);
        });
    }
}

// Test message helper
function sendMessage(ws, type, data) {
    ws.send(JSON.stringify({ type, ...data }));
}

// Test response helper
async function waitForMessage(ws, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.error('Timeout waiting for message');
            reject(new Error('Timeout waiting for message'));
        }, timeout);
        
        ws.once('message', (data) => {
            clearTimeout(timer);
            const parsed = JSON.parse(data.toString());
            console.log('Received message:', parsed.type);
            resolve(parsed);
        });
    });
}

// Helper to wait for specific message type
async function waitForMessageType(ws, type, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.error(`Timeout waiting for ${type} message`);
            reject(new Error(`Timeout waiting for ${type} message`));
        }, timeout);
        
        const messageHandler = (data) => {
            const parsed = JSON.parse(data.toString());
            console.log('Received message:', parsed.type);
            
            if (parsed.type === type) {
                clearTimeout(timer);
                ws.removeListener('message', messageHandler);
                resolve(parsed);
            }
        };
        
        ws.on('message', messageHandler);
    });
}

// Helper to wait for a message that is NOT available_commands
async function waitForNonCommandMessage(ws, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            console.error('Timeout waiting for non-command message');
            reject(new Error('Timeout waiting for non-command message'));
        }, timeout);
        
        const messageHandler = (data) => {
            const parsed = JSON.parse(data.toString());
            console.log('Received message:', parsed.type);
            
            if (parsed.type !== 'available_commands') {
                clearTimeout(timer);
                ws.removeListener('message', messageHandler);
                resolve(parsed);
            }
        };
        
        ws.on('message', messageHandler);
    });
}

// Helper to clear message queue
async function clearMessageQueue(ws) {
    return new Promise((resolve) => {
        const messages = [];
        const messageHandler = (data) => {
            messages.push(JSON.parse(data.toString()));
        };
        
        ws.on('message', messageHandler);
        setTimeout(() => {
            ws.removeListener('message', messageHandler);
            console.log(`Cleared ${messages.length} messages from queue`);
            resolve();
        }, 100);
    });
}

// Helper to wait for a sequence of messages
async function waitForMessageSequence(ws, types, timeout = 10000) {
    console.log('Waiting for messages:', types);
    const results = {};
    const remainingTypes = new Set(types);
    
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for messages: ${Array.from(remainingTypes).join(', ')}`));
        }, timeout);
        
        const messageHandler = (data) => {
            const parsed = JSON.parse(data.toString());
            console.log(`Received message type: ${parsed.type}, looking for: ${Array.from(remainingTypes)}`);
            if (remainingTypes.has(parsed.type)) {
                console.log(`Found expected message type: ${parsed.type}`);
                results[parsed.type] = parsed;
                remainingTypes.delete(parsed.type);
                
                if (remainingTypes.size === 0) {
                    console.log('All expected messages received');
                    clearTimeout(timer);
                    ws.removeListener('message', messageHandler);
                    resolve(results);
                }
            }
        };
        
        ws.on('message', messageHandler);
    });
}

// Run tests
async function runTests() {
    console.log('Starting tests...');

    // Helper to run a test with its own server and port
    async function runTestWithDedicatedServer(testName, testFn) {
        const port = 30000 + Math.floor(Math.random() * 1000);
        const uniqueId = Date.now() + Math.random(); // Generate unique ID
        console.log(`\nRunning ${testName} on port ${port}`);
        
        await withServer(async (serverPort) => {
            await withWebSocket(serverPort, async (ws) => {
                // Helper to create a test note
                async function createTestNote(title) {
                    await clearMessageQueue(ws);
                    sendMessage(ws, 'chat', { text: `/createnote ${title}` });
                    const response = await waitForMessageType(ws, 'reply');
                    assert(response.text.includes('Do you want to create a note'));
    
                    sendMessage(ws, 'chat', { text: 'yes' });
                    const createResponse = await waitForMessageType(ws, 'created_note');
                    assertEqual(createResponse.note.title, title);
                    return createResponse.note.id;
                }
                
                await testFn(ws, createTestNote, serverPort, uniqueId);
            });
        });
    }

    // Test 1: Create a note
    await runTestWithDedicatedServer('should create a note', async (ws, createTestNote) => {
        const noteId = await createTestNote('Test Note');
        assert(noteId);
    });
            


    // Test 2: Find a note by title
await runTestWithDedicatedServer('should find a note by title', async (ws, createTestNote, uniqueId) => {
    const timestamp = Date.now();
    const title = `Test Note ${timestamp}`;
    
    // Create a note first
    await clearMessageQueue(ws);
    sendMessage(ws, 'chat', { text: `/createnote ${title}` });
    const response = await waitForMessageType(ws, 'reply');
    assert(response.text.includes('Do you want to create a note'));
    
    sendMessage(ws, 'chat', { text: 'yes' });
    const createResponse = await waitForMessageType(ws, 'created_note');
    assertEqual(createResponse.note.title, title);
    
    // Add a delay to ensure the note is fully saved
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now find the note
    sendMessage(ws, 'chat', { text: `/findnote ${title}` });
    const notesResponse = await waitForMessageType(ws, 'found_notes');
    
    // Check that we found the note
    assert(notesResponse.notes.length > 0, 'No notes found');
    
    // Find the exact note we created (in case multiple notes are returned)
    const createdNote = notesResponse.notes.find(note => note.title === title);
    assert(createdNote !== undefined, `Note with title "${title}" not found in search results`);
    
    // Check that the note ID matches
    console.log('Expected note ID:', createResponse.note.id);
    console.log('Actual note ID:', createdNote.id);
    console.log('Expected type:', typeof createResponse.note.id);
    console.log('Actual type:', typeof createdNote.id);
    
    // Use string comparison to avoid type issues
    assert(String(createdNote.id) === String(createResponse.note.id), 
            `Expected note ID to be ${createResponse.note.id}, but got ${createdNote.id}`);
    
    return true;
});

    // Test 3: Find a note by ID
    await runTestWithDedicatedServer('should find a note by ID', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note ID ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        sendMessage(ws, 'chat', { text: `/findbyid ${noteId}` });
        
        // Get both messages in any order
        const messages = await waitForMessageSequence(ws, ['found_notes', 'reply']);
        const notesResponse = messages.found_notes;
        assert(notesResponse.notes.length === 1);
        assertEqual(notesResponse.notes[0].id, noteId);
    });

    // Test 4: Show parent notes
    await runTestWithDedicatedServer('should show parent notes', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Parent ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        sendMessage(ws, 'chat', { text: '/showparents' });
        
        // /showparents only sends found_notes, not reply
        const notesResponse = await waitForMessageType(ws, 'found_notes');
        assert(notesResponse.notes.length > 0);
        assert(notesResponse.notes.some(note => note.id === noteId));
    });

    // Test: Edit note description
    await runTestWithDedicatedServer('should edit note description', async (ws, createTestNote, uniqueId) => {
        const timestamp = Date.now();
        const title = `Test Note ${timestamp}`;
        const newDescription = `Updated description ${timestamp}`;

        // Create a note first
        const noteId = await createTestNote(title);

        // Edit the note description
        sendMessage(ws, 'chat', { text: `/editnotedescription ${noteId} description ${newDescription}` });
        await waitForMessageType(ws, 'note_updated');

        // Find the note to verify the description was updated
        sendMessage(ws, 'chat', { text: `/findnote ${title}` });
        const notesResponse = await waitForMessageType(ws, 'found_notes');

        // Check that we found the note
        assert(notesResponse.notes.length > 0, 'No notes found');

        // Find the exact note we created
        const editedNote = notesResponse.notes.find(note => note.title === title);
        assert(editedNote !== undefined, `Note with title "${title}" not found in search results`);

        // Check that the description was updated
        console.log('Expected description:', newDescription);
        console.log('Actual description:', editedNote.description);
        assertEqual(editedNote.description, newDescription);

        return true;
    });

    // Test 6: Create a sub-note
    await runTestWithDedicatedServer('should create a sub-note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Sub ${uniqueId}`;
        console.log('!!!Creating note with title:', noteTitle);
        const noteId = await createTestNote(noteTitle);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a 1 second delay
        console.log('!!!Created note with ID:', noteId);
        sendMessage(ws, 'chat', { text: `/createsubnote ${noteId}` });
        console.log('!!!Sent createsubnote command for note ID:', noteId);
        
        // Wait for the reply message (skip available_commands)
        const response = await waitForNonCommandMessage(ws);
        assertEqual(response.type, 'reply');
        assert(response.text.includes('What is the title of the sub-note'));
        
        sendMessage(ws, 'chat', { text: 'Sub Note' });
        
        // Wait for the reply message (skip available_commands)
        const confirmResponse = await waitForNonCommandMessage(ws);
        assertEqual(confirmResponse.type, 'reply');
        assert(confirmResponse.text.includes('Create sub-note'));

        sendMessage(ws, 'chat', { text: 'yes' });
        
        // Wait for the created_note message (skip available_commands)
        const createResponse = await waitForNonCommandMessage(ws);
        console.log('!!!!Create sub-note response:', createResponse);
        assertEqual(createResponse.type, 'created_note');
        assertEqual(createResponse.note.title, 'Sub Note');
        assertEqual(createResponse.note.parent_id, noteId);
    });

    // Test 7: Mark a note as done
    await runTestWithDedicatedServer('should mark a note as done', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Done ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        console.log('--- Mark Done Test: Created note with ID:', noteId);
        await clearMessageQueue(ws);
        console.log('--- Mark Done Test: Finding note:', noteTitle);
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        const findResponse = await waitForMessageSequence(ws, ['found_notes', 'reply']);
        console.log('--- Mark Done Test: Found note response:', findResponse);

        console.log('--- Mark Done Test: Sending /markdone');
        sendMessage(ws, 'chat', { text: '/markdone' });
        
        // Wait for the reply message (skip available_commands)
        const response = await waitForNonCommandMessage(ws);
        console.log('--- Mark Done Test: Mark done response:', response);
        assertEqual(response.type, 'reply');
        assert(response.text.includes('Are you sure you want to mark'));

        console.log('--- Mark Done Test: Sending yes');
        sendMessage(ws, 'chat', { text: 'yes' });
        
        // Wait for the note_updated message (skip available_commands)
        const doneResponse = await waitForNonCommandMessage(ws);
        console.log('--- Mark Done Test: Final done response:', doneResponse);
        assertEqual(doneResponse.type, 'note_updated');
        assert(doneResponse.note.done);
    });

    // Test 8: Start AI conversation
    await runTestWithDedicatedServer('should start AI conversation', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note AI ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        console.log('--- AI Test: Clearing message queue ---');
        await clearMessageQueue(ws);

        console.log(`--- AI Test: Finding note: ${noteTitle} ---`);
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        console.log('--- AI Test: Note found ---');

        console.log('--- AI Test: Starting AI conversation ---');
        sendMessage(ws, 'chat', { text: '/talkai' });
        
        // Wait for the reply message (skip available_commands)
        const response = await waitForNonCommandMessage(ws);
        console.log('--- AI Test: Received response for /talkai ---', response);
        assertEqual(response.type, 'reply');
        assert(response.text.includes('Starting AI conversation'));
        console.log('--- AI Test: AI conversation started ---');

        console.log('--- AI Test: Stopping AI conversation ---');
        sendMessage(ws, 'chat', { text: '/stop' });
        
        // Wait for the reply message (skip available_commands)
        const stopResponse = await waitForNonCommandMessage(ws);
        console.log('--- AI Test: Received response for /stop ---', stopResponse);
        assertEqual(stopResponse.type, 'reply');
        assert(stopResponse.text.includes('AI conversation ended'));
        console.log('--- AI Test: AI conversation ended ---');
    });

    // Test 9: Select sub-note
    await runTestWithDedicatedServer('should select sub-note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Select ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);

        // Create a sub-note
        sendMessage(ws, 'chat', { text: `/createsubnote ${noteId}` });
        await waitForMessageType(ws, 'reply'); // "What is the title..."
        sendMessage(ws, 'chat', { text: 'Sub Note' });
        await waitForMessageType(ws, 'reply'); // "Create sub-note...?"
        sendMessage(ws, 'chat', { text: 'yes' });
        await waitForMessageType(ws, 'created_note');
        await waitForMessageType(ws, 'reply');
        await clearMessageQueue(ws);

        // Now find the parent note
        sendMessage(ws, 'chat', { text: `/findbyid ${noteId}` });
        
        // Get both messages in any order
        const messages = await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        const findResponse = messages.found_notes;
        
        const subNote = findResponse.notes.find(note => note.title === 'Sub Note');
        assert(subNote, 'Sub-note not found in find results');
        sendMessage(ws, 'chat', { text: `/selectsubnote ${subNote.id}` });
        
        // Wait for the reply message (skip available_commands)
        const response = await waitForNonCommandMessage(ws);
        assertEqual(response.type, 'reply');
        assert(response.text.includes('Selected note'));
    });

    // Test 10: Test for uploading an image to a note (SKIPPED - requires image file)
   // Test for uploading an image to a note
   /*
await runTestWithDedicatedServer('should upload an image to a note', async (ws, createTestNote, uniqueId) => {
    const noteTitle = `Test Note Image ${uniqueId}`;
    const noteId = await createTestNote(noteTitle);
    await clearMessageQueue(ws);
    
    // Find the note first to get its current state
    sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
    let response = await waitForMessage(ws, ['found_notes', 'reply']);
    console.log('--- Find note response:', JSON.stringify(response, null, 2));
    assertEqual(response.type, 'found_notes');
    const currentImageCount = response.notes[0].images.length;
    console.log(`--- Current image count: ${currentImageCount}`);
    
    // Find the note to get into the note context
    sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
    response = await waitForMessage(ws, ['found_notes', 'reply']);
    console.log('--- Find note response for context:', JSON.stringify(response, null, 2));
    
    await clearMessageQueue(ws);
    // Now send upload image command in the context of the found note
    sendMessage(ws, 'chat', { text: '/uploadimage' });
    response = await waitForMessage(ws);
    console.log('--- Upload image command response:', JSON.stringify(response, null, 2));
    assertEqual(response.type, 'request_image_upload');
    assert(response.data.noteId);
    assertEqual(typeof response.data.currentImageCount, 'number');
    console.log(`--- Request note ID: ${response.data.noteId}, Image count: ${response.data.currentImageCount}`);
    
    // Simulate image upload
    const imagePath = '/Users/yurikalinin/ws/github.com/yorikya/inote/android/native-gradle-node-folder/app/src/main/assets/nodejs-project/images/note_2_test.png';
    const fs = require('fs');
    const imageData = fs.readFileSync(imagePath, 'base64');
    console.log(`--- Reading image from path: ${imagePath}, size: ${imageData.length} characters`);
    
    sendMessage(ws, 'image_upload', {
        noteId: noteId,
        imageData: imageData,
        imageName: 'note_2_test.png'
    });
    console.log(`--- Sent image upload data for note ID: ${noteId}`);
    
    // Wait for the image upload confirmation
    response = await waitForMessage(ws);
    console.log('--- Image upload confirmation response:', JSON.stringify(response, null, 2));
    assertEqual(response.type, 'reply');
    sendMessage(ws, 'chat', { text: 'yes' });
    response = await waitForMessage(ws);
    console.log('--- Sent confirmation to add image to note ---', response);
    response = await waitForMessageType(ws, 'reply');
    console.log('--- Final reply after image upload:', JSON.stringify(response, null, 2));
    // Find the note again to verify the image was added
    sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
    const updatedResponse = await waitForMessage(ws, ['found_notes', 'reply']);
    console.log('--- Updated note response:', JSON.stringify(updatedResponse, null, 2));
    assertEqual(updatedResponse.type, 'found_notes');
    
    // Verify the image count increased by 1
    const newImageCount = updatedResponse.notes[0].images.length;
    console.log(`--- New image count: ${newImageCount}, expected: ${currentImageCount + 1}`);
    assertEqual(newImageCount, currentImageCount + 1);
    
    // Verify the image name is in the images array
    const imageNames = updatedResponse.notes[0].images.map(img => {
        console.log("--- img", img); 
        return img;
    });
    console.log('--- Image names in note:', imageNames);
    
    // Check if any image name ends with the original filename
    const hasExpectedImage = imageNames.some(name => name.endsWith('note_2_test.png'));
    assert(hasExpectedImage, `Expected to find an image ending with 'note_2_test.png', but got: ${imageNames.join(', ')}`);
    console.log('--- Test passed: Image successfully uploaded and verified');
});
*/



    // Test 11: Delete a note
    await runTestWithDedicatedServer('should delete a note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Delete ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        console.log('--- noteid to delete:', noteId);
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        
        // Clear any remaining messages
        await clearMessageQueue(ws);
        
        sendMessage(ws, 'chat', { text: '/delete' });
        
        // Wait for the reply message (skip available_commands)
        const confirmResponse = await waitForNonCommandMessage(ws);
        console.log('--- confirm response:', confirmResponse);
        assertEqual(confirmResponse.type, 'reply');
        console.log('--- confirmResponse.text:', confirmResponse.text);
       //assert(/Are you sure you want to delete note/.test(response.text));
        assert(confirmResponse.text.includes("Are you sure you want to delete note '"));
       
        console.log('--- sending confirmation ---');
        sendMessage(ws, 'chat', { text: 'yes' });
        console.log('--- confirmation sent ---');

        // Wait for the note_deleted message (skip available_commands)
        const deleteResponse = await waitForNonCommandMessage(ws);
        console.log('--- delete response 2:', deleteResponse);
        assertEqual(deleteResponse.type, 'note_deleted');
    });

    // Test 12: Auto-confirm feature - Create note without confirmation
    await runTestWithDedicatedServer('should create note with auto-confirm enabled', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Auto Confirm Create ${uniqueId}`;
        
        // Enable auto-confirm
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for setting to apply
        
        // Create a note - should NOT ask for confirmation
        console.log('--- Creating note with auto-confirm enabled ---');
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
        
        const response = await waitForMessage(ws);
        console.log('--- Response:', response);
        
        // Should receive created_note directly, not a confirmation prompt
        assertEqual(response.type, 'created_note');
        assertEqual(response.note.title, noteTitle);
        assert(!response.text || !response.text.includes('Do you want to create'), 
               'Should NOT ask for confirmation when auto-confirm is enabled');
        
        console.log('--- Test passed: Note created without confirmation prompt ---');
    });

    // Test 13: Auto-confirm feature - Delete note without confirmation
    await runTestWithDedicatedServer('should delete note with auto-confirm enabled', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Auto Confirm Delete ${uniqueId}`;
        
        // Create a note first (with normal confirmation)
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        // Enable auto-confirm
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Find the note to set context
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply']);
        
        // Delete the note - should NOT ask for confirmation
        console.log('--- Deleting note with auto-confirm enabled ---');
        sendMessage(ws, 'chat', { text: '/delete' });
        
        const response = await waitForMessage(ws);
        console.log('--- Delete response:', response);
        
        // Should receive note_deleted directly, not a confirmation prompt
        assertEqual(response.type, 'note_deleted');
        assertEqual(response.id, noteId);
        
        console.log('--- Test passed: Note deleted without confirmation prompt ---');
    });

    // Test 14: Auto-confirm feature - Mark done without confirmation
    await runTestWithDedicatedServer('should mark note as done with auto-confirm enabled', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Auto Confirm Done ${uniqueId}`;
        
        // Create a note first
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        // Enable auto-confirm
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Find the note to set context
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply']);
        
        // Mark as done - should NOT ask for confirmation
        console.log('--- Marking note as done with auto-confirm enabled ---');
        sendMessage(ws, 'chat', { text: '/markdone' });
        
        const response = await waitForMessage(ws);
        console.log('--- Mark done response:', response);
        
        // Should receive note_updated directly, not a confirmation prompt
        assertEqual(response.type, 'note_updated');
        assert(response.note.done === true);
        assertEqual(response.note.id, noteId);
        
        console.log('--- Test passed: Note marked as done without confirmation prompt ---');
    });

    // Test 15: Auto-confirm feature - Edit description without confirmation
    await runTestWithDedicatedServer('should edit note description with auto-confirm enabled', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Auto Confirm Edit ${uniqueId}`;
        const newDescription = `Auto confirmed description ${uniqueId}`;
        
        // Create a note first
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        // Enable auto-confirm
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Edit the note description - should NOT ask for confirmation
        console.log('--- Editing note description with auto-confirm enabled ---');
        sendMessage(ws, 'chat', { text: `/editnotedescription ${noteId} description ${newDescription}` });
        
        const response = await waitForMessage(ws);
        console.log('--- Edit response:', response);
        
        // Should receive note_updated directly, not a confirmation prompt
        assertEqual(response.type, 'note_updated');
        assertEqual(response.note.description, newDescription);
        
        console.log('--- Test passed: Note description edited without confirmation prompt ---');
    });

    // Test 16: Auto-confirm feature - Toggle off and verify confirmation returns
    await runTestWithDedicatedServer('should require confirmation after disabling auto-confirm', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Auto Confirm Toggle ${uniqueId}`;
        
        // Enable auto-confirm first
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create a note without confirmation
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
        let response = await waitForMessage(ws);
        assertEqual(response.type, 'created_note');
        
        await clearMessageQueue(ws);
        
        // Now disable auto-confirm
        console.log('--- Disabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: false });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to create another note - should ask for confirmation
        const noteTitle2 = `Test Auto Confirm Toggle 2 ${uniqueId}`;
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle2}` });
        
        // Wait for the reply message (skip available_commands)
        response = await waitForNonCommandMessage(ws);
        console.log('--- Response after disabling auto-confirm:', response);
        
        // Should receive confirmation prompt
        assertEqual(response.type, 'reply');
        assert(response.text.includes('Do you want to create a note'), 
               'Should ask for confirmation when auto-confirm is disabled');
        
        console.log('--- Test passed: Confirmation prompt returned after disabling auto-confirm ---');
    });

    // Test 17: Auto-confirm feature - Create sub-note without confirmation
    await runTestWithDedicatedServer('should create sub-note with auto-confirm enabled', async (ws, createTestNote, uniqueId) => {
        const parentTitle = `Test Auto Confirm Parent ${uniqueId}`;
        const subNoteTitle = `Auto Sub Note ${uniqueId}`;
        
        // Create parent note first
        const parentId = await createTestNote(parentTitle);
        await clearMessageQueue(ws);
        
        // Enable auto-confirm
        console.log('--- Enabling auto-confirm ---');
        sendMessage(ws, 'set_auto_confirm', { enabled: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start sub-note creation
        sendMessage(ws, 'chat', { text: `/createsubnote ${parentId}` });
        let response = await waitForNonCommandMessage(ws);
        assertEqual(response.type, 'reply');
        assert(response.text.includes('What is the title of the sub-note'));
        
        // Provide sub-note title - should NOT ask for confirmation
        sendMessage(ws, 'chat', { text: subNoteTitle });
        response = await waitForNonCommandMessage(ws);
        
        console.log('--- Sub-note creation response:', response);
        
        // Should receive created_note directly, not a confirmation prompt
        assertEqual(response.type, 'created_note');
        assertEqual(response.note.title, subNoteTitle);
        assertEqual(response.note.parent_id, parentId);
        
        console.log('--- Test passed: Sub-note created without confirmation prompt ---');
    });

    // Test 18: Context-aware quick commands - Main menu commands
    await runTestWithDedicatedServer('should return main menu commands when in initial state', async (ws, createTestNote, uniqueId) => {
        console.log('--- Testing main menu commands ---');
        
        // Request available commands
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands:', response.commands);
        
        // Should have main menu commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names:', commandNames);
        
        // Check for main menu commands
        assert(commandNames.includes('/createnote'), 'Should include /createnote command');
        assert(commandNames.includes('/findnote'), 'Should include /findnote command');
        assert(commandNames.includes('/findbyid'), 'Should include /findbyid command');
        assert(commandNames.includes('/showparents'), 'Should include /showparents command');
        
        // Should NOT have note-specific commands in main menu
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription in main menu');
        assert(!commandNames.includes('/markdone'), 'Should NOT include /markdone in main menu');
        assert(!commandNames.includes('/delete'), 'Should NOT include /delete in main menu');
        
        console.log('--- Test passed: Main menu commands returned correctly ---');
    });

    // Test 19: Context-aware quick commands - Note context commands
    await runTestWithDedicatedServer('should return note context commands when note is selected', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Context ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        console.log('--- Testing note context commands ---');
        
        // Find the note to enter note context
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        
        // Request available commands again to get updated context
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands in note context:', response.commands);
        
        // Should have note-specific commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in note context:', commandNames);
        
        // Check for note context commands
        assert(commandNames.includes('/editdescription'), 'Should include /editdescription command');
        assert(commandNames.includes('/markdone'), 'Should include /markdone command');
        assert(commandNames.includes('/delete'), 'Should include /delete command');
        assert(commandNames.includes('/createsubnote'), 'Should include /createsubnote command');
        assert(commandNames.includes('/talkai'), 'Should include /talkai command');
        assert(commandNames.includes('/selectsubnote'), 'Should include /selectsubnote command');
        assert(commandNames.includes('/uploadimage'), 'Should include /uploadimage command');
        
        // Should NOT have main menu commands in note context
        assert(!commandNames.includes('/createnote'), 'Should NOT include /createnote in note context');
        assert(!commandNames.includes('/findnote'), 'Should NOT include /findnote in note context');
        assert(!commandNames.includes('/findbyid'), 'Should NOT include /findbyid in note context');
        assert(!commandNames.includes('/showparents'), 'Should NOT include /showparents in note context');
        
        console.log('--- Test passed: Note context commands returned correctly ---');
    });

    // Test 20: Context-aware quick commands - Confirmation commands
    await runTestWithDedicatedServer('should return confirmation commands when in confirmation state', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Confirm ${uniqueId}`;
        
        console.log('--- Testing confirmation commands ---');
        
        // Start note creation to enter confirmation state
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
        
        // Wait for the confirmation prompt (skip any initial messages)
        let confirmResponse;
        do {
            confirmResponse = await waitForMessageType(ws, 'reply');
        } while (!confirmResponse.text.includes('Do you want to create a note'));
        
        assert(confirmResponse.text.includes('Do you want to create a note'));
        
        // Request available commands during confirmation
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands in confirmation state:', response.commands);
        
        // Should have confirmation commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in confirmation state:', commandNames);
        
        // Check for confirmation commands
        assert(commandNames.includes('yes'), 'Should include yes command');
        assert(commandNames.includes('no'), 'Should include no command');
        
        // Should NOT have other commands during confirmation
        assert(!commandNames.includes('/createnote'), 'Should NOT include /createnote during confirmation');
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during confirmation');
        
        console.log('--- Test passed: Confirmation commands returned correctly ---');
    });

    // Test 21: Context-aware quick commands - Story editing commands
    await runTestWithDedicatedServer('should return story editing commands when in editing mode', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Edit ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        console.log('--- Testing story editing commands ---');
        
        // Find the note and enter edit mode
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        
        // Start editing
        sendMessage(ws, 'chat', { text: '/editdescription' });
        await waitForMessageType(ws, 'reply');
        
        // Request available commands during editing
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands in story editing state:', response.commands);
        
        // Should have story editing commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in story editing state:', commandNames);
        
        // Check for story editing commands
        assert(commandNames.includes('/stopediting'), 'Should include /stopediting command');
        
        // Should NOT have other commands during editing
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during editing');
        assert(!commandNames.includes('/markdone'), 'Should NOT include /markdone during editing');
        
        console.log('--- Test passed: Story editing commands returned correctly ---');
    });

    // Test 22: Context-aware quick commands - AI conversation commands
    await runTestWithDedicatedServer('should return AI conversation commands when in AI mode', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note AI ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        console.log('--- Testing AI conversation commands ---');
        
        // Find the note and start AI conversation
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply', 'available_commands']);
        
        // Start AI conversation
        sendMessage(ws, 'chat', { text: '/talkai' });
        await waitForMessageType(ws, 'reply');
        
        // Request available commands during AI conversation
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands in AI conversation state:', response.commands);
        
        // Should have AI conversation commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in AI conversation state:', commandNames);
        
        // Check for AI conversation commands
        assert(commandNames.includes('/stop'), 'Should include /stop command');
        assert(commandNames.includes('exit'), 'Should include exit command');
        assert(commandNames.includes('cancel'), 'Should include cancel command');
        
        // Should NOT have other commands during AI conversation
        assert(!commandNames.includes('/talkai'), 'Should NOT include /talkai during AI conversation');
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during AI conversation');
        
        console.log('--- Test passed: AI conversation commands returned correctly ---');
    });

    // Test 23: Context-aware quick commands - Sub-note creation commands
    await runTestWithDedicatedServer('should return sub-note creation commands when creating sub-note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Sub ${uniqueId}`;
        const noteId = await createTestNote(noteTitle);
        await clearMessageQueue(ws);
        
        console.log('--- Testing sub-note creation commands ---');
        
        // Start sub-note creation
        sendMessage(ws, 'chat', { text: `/createsubnote ${noteId}` });
        await waitForMessageType(ws, 'reply');
        
        // Request available commands during sub-note creation
        sendMessage(ws, 'get_commands');
        const response = await waitForMessageType(ws, 'available_commands');
        
        console.log('--- Available commands in sub-note creation state:', response.commands);
        
        // Should have sub-note creation commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in sub-note creation state:', commandNames);
        
        // Check for sub-note creation commands
        assert(commandNames.includes('yes'), 'Should include yes command');
        assert(commandNames.includes('no'), 'Should include no command');
        
        // Should NOT have other commands during sub-note creation
        assert(!commandNames.includes('/createsubnote'), 'Should NOT include /createsubnote during creation');
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during creation');
        
        console.log('--- Test passed: Sub-note creation commands returned correctly ---');
    });

    // Test 24: Context-aware quick commands - Commands update automatically on state change
    await runTestWithDedicatedServer('should automatically update commands when state changes', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Auto Update ${uniqueId}`;
        
        console.log('--- Testing automatic command updates ---');
        
        // Start in main menu - should have main menu commands
        sendMessage(ws, 'get_commands');
        let response = await waitForMessageType(ws, 'available_commands');
        let commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('/createnote'), 'Should start with main menu commands');
        
        // Create a note to enter confirmation state
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
        await waitForMessageType(ws, 'reply'); // Confirmation prompt
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait for auto-updated commands
        
        // Should now have confirmation commands
        sendMessage(ws, 'get_commands');
        response = await waitForMessageType(ws, 'available_commands');
        commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('yes'), 'Should have confirmation commands after state change');
        assert(!commandNames.includes('/createnote'), 'Should NOT have main menu commands in confirmation state');
        
        // Confirm the note creation
        sendMessage(ws, 'chat', { text: 'yes' });
        await waitForMessageType(ws, 'created_note');
        
        // Wait for the reply message (skip any available_commands)
        let replyResponse;
        do {
            replyResponse = await waitForMessageType(ws, 'reply');
        } while (!replyResponse.text.includes('Note created successfully'));
        
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait for auto-updated commands
        
        // Should be back to main menu commands
        sendMessage(ws, 'get_commands');
        response = await waitForMessageType(ws, 'available_commands');
        commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('/createnote'), 'Should return to main menu commands after confirmation');
        assert(!commandNames.includes('yes'), 'Should NOT have confirmation commands after confirmation');
        
        console.log('--- Test passed: Commands automatically updated on state changes ---');
    });

    console.log('All tests passed!');
}

// Run the tests
runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
