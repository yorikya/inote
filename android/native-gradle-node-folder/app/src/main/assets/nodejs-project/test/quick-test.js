const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testContextCommands() {
    console.log('Testing context-aware commands...');
    
    // Set overall timeout for the entire test
    const testTimeout = setTimeout(() => {
        console.error('Test timed out after 30 seconds');
        process.exit(1);
    }, 30000);
    
    // Clean up test data
    const notesFile = path.join(__dirname, '../notes.test.json');
    if (fs.existsSync(notesFile)) {
        fs.writeFileSync(notesFile, '[]');
        console.log('Cleaned up notes.test.json');
    }
    
    const port = 30000 + Math.floor(Math.random() * 1000);
    const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
        env: { ...process.env, NODE_PORT: port.toString(), NODE_ENV: 'test' },
        stdio: 'inherit'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {

        const ws = new WebSocket(`ws://localhost:${port}`);
        
        await new Promise(resolve => {
            ws.on('open', resolve);
        });

        // Wait for initial connection message (wait for any message to ensure connection is ready)
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for initial connection message'));
            }, 5000);
            
            ws.once('message', (data) => {
                clearTimeout(timeout);
                resolve(); // Just wait for any message to ensure connection is ready
            });
        });

        // Test 1: Get initial commands (should be main menu)
        console.log('1. Testing main menu commands...');
        ws.send(JSON.stringify({ type: 'get_commands' }));
        
        const initialResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for available_commands'));
            }, 5000);
            
            ws.once('message', (data) => {
                clearTimeout(timeout);
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'available_commands') {
                    resolve(parsed);
                }
            });
        });
        
        const initialCommands = initialResponse.commands.map(cmd => cmd.command);
        console.log('Initial commands:', initialCommands);
        
        if (initialCommands.includes('/createnote') && initialCommands.includes('/findnote')) {
            console.log('✓ Main menu commands working');
        } else {
            console.log('✗ Main menu commands failed');
        }

        // Test 2: Create a note and find it to get note context commands
        console.log('2. Testing note context commands...');
        
        // Create a note
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Test Note' }));
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for note creation prompt')), 5000);
            const messageHandler = (data) => {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'reply' && parsed.text && parsed.text.includes('Do you want to create')) {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve();
                }
            };
            ws.on('message', messageHandler);
        });
        
        // Confirm creation
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for note creation')), 5000);
            const messageHandler = (data) => {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'created_note') {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve();
                }
            };
            ws.on('message', messageHandler);
        });
        
        // Find the note
        ws.send(JSON.stringify({ type: 'chat', text: '/findnote Test Note' }));
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for note search')), 5000);
            const messageHandler = (data) => {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'found_notes') {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve();
                }
            };
            ws.on('message', messageHandler);
        });
        
        // Get commands in note context
        ws.send(JSON.stringify({ type: 'get_commands' }));
        const noteContextResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for note context commands')), 5000);
            const messageHandler = (data) => {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'available_commands') {
                    clearTimeout(timeout);
                    ws.removeListener('message', messageHandler);
                    resolve(parsed);
                }
            };
            ws.on('message', messageHandler);
        });
        
        const noteContextCommands = noteContextResponse.commands.map(cmd => cmd.command);
        console.log('Note context commands:', noteContextCommands);
        
        if (noteContextCommands.includes('/editdescription') && noteContextCommands.includes('/delete')) {
            console.log('✓ Note context commands working');
        } else {
            console.log('✗ Note context commands failed');
        }

        ws.close();
        console.log('Context-aware commands test completed!');
        
        // Clear the timeout since test completed successfully
        clearTimeout(testTimeout);
        
    } catch (error) {
        console.error('Test failed:', error);
        clearTimeout(testTimeout);
        throw error;
    } finally {
        if (serverProcess) {
            serverProcess.kill();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

testContextCommands().catch(console.error);
