const assert = require('assert');

// Mock the app object for testing
global.app = {
    ReadFile: (filename) => {
        if (filename === 'notes.json') {
            return JSON.stringify({ notes: [], last_note_id: 0 });
        }
        return '';
    },
    WriteFile: (filename, content) => {
        // Mock write operation
        console.log('Mock WriteFile:', filename, content.substring(0, 100) + '...');
    }
};

const WebSocketHandler = require('../WebSocketHandler');
const StateManager = require('../StateManager');
const NoteManager = require('../NoteManager');
const CommandRouter = require('../CommandRouter');

// Make modules available globally for WebSocketHandler
global.StateManager = StateManager;
global.NoteManager = NoteManager;
global.CommandRouter = CommandRouter;

class NewAutoConfirmationTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    recordStep(action, input, response) {
        this.currentStep++;
        this.testSteps.push({
            step: this.currentStep,
            action: action,
            input: input,
            response: response,
            timestamp: new Date().toISOString()
        });
    }

    printTestSteps() {
        console.log('\n📋 Test Steps Recorded:');
        console.log('-'.repeat(30));
        for (let i = 0; i < this.testSteps.length; i++) {
            const step = this.testSteps[i];
            console.log(`Step ${step.step}: ${step.action}`);
            console.log(`  Input: ${step.input}`);
            console.log(`  Response: ${String(step.response).substring(0, 100)}...`);
            console.log('');
        }
    }

    async simulateMessage(text, autoConfirm = false) {
        const mockClient = {
            send: (msg) => {
                const parsedMsg = JSON.parse(msg);
                this.lastResponse = parsedMsg.text;
                this.lastCommands = parsedMsg.commands;
            }
        };
        const mockIp = '::1';
        const mockId = 'test_client';

        // Simulate client sending message with autoConfirm setting
        WebSocketHandler.handleChatMessage({
            type: 'chat',
            text: text,
            lang: 'en',
            autoConfirm: autoConfirm
        }, mockIp, mockId);

        await new Promise(resolve => setTimeout(resolve, 10));
        return this.lastResponse;
    }

    async run() {
        console.log('🧪 Testing: New Auto Confirmation System');
        console.log('Testing: Global auto confirmation state and explicit commands');
        console.log('='.repeat(50));

        // Clear all states before starting
        StateManager.clearAllStates();
        NoteManager.clearAllNotes();
        WebSocketHandler.Settings = { lang: "en", autoConfirm: false };

        try {
            // Test 1: Check initial state
            await this.test1_InitialState();

            // Test 2: Test explicit commands
            await this.test2_ExplicitCommands();

            // Test 3: Test auto confirmation with sub-note creation
            await this.test3_AutoConfirmationSubNote();

            console.log('✅ New Auto Confirmation Test PASSED!');
            this.printTestSteps();

        } catch (error) {
            console.log('❌ New Auto Confirmation Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async test1_InitialState() {
        console.log('\n🔍 Test 1: Initial State');
        this.recordStep('Check initial auto confirm state', 'Initial state', WebSocketHandler.Settings.autoConfirm);
        assert.strictEqual(WebSocketHandler.Settings.autoConfirm, false, 'Initial auto confirm should be false');
    }

    async test2_ExplicitCommands() {
        console.log('\n⚙️ Test 2: Explicit Commands');
        
        // Test enable command
        const enableResponse = await this.simulateMessage('/autoconfirmon');
        this.recordStep('Enable auto confirm', '/autoconfirmon', enableResponse);
        assert(enableResponse.includes('Auto confirmation enabled'), `Expected enable message, got: ${enableResponse}`);
        assert.strictEqual(WebSocketHandler.Settings.autoConfirm, true, 'Auto confirm should be true after enable');

        // Test disable command
        const disableResponse = await this.simulateMessage('/autoconfirmoff');
        this.recordStep('Disable auto confirm', '/autoconfirmoff', disableResponse);
        assert(disableResponse.includes('Auto confirmation disabled'), `Expected disable message, got: ${disableResponse}`);
        assert.strictEqual(WebSocketHandler.Settings.autoConfirm, false, 'Auto confirm should be false after disable');
    }

    async test3_AutoConfirmationSubNote() {
        console.log('\n📝 Test 3: Auto Confirmation Sub-Note Creation');
        
        // Enable auto confirm first
        await this.simulateMessage('/autoconfirmon');
        this.recordStep('Enable auto confirm for test', '/autoconfirmon', 'Enabled');
        assert.strictEqual(WebSocketHandler.Settings.autoConfirm, true, 'Auto confirm should be enabled');

        // Create a parent note
        const createResponse = await this.simulateMessage('/createnote test parent', true);
        this.recordStep('Create parent note', '/createnote test parent', createResponse);
        assert(createResponse.includes('Note created successfully'), 'Expected parent note creation');
        
        // Find the parent note to set context
        const findResponse = await this.simulateMessage('/findbyid 1', true);
        this.recordStep('Find parent note', '/findbyid 1', findResponse);
        assert(findResponse.includes('Found note:'), 'Expected to find parent note');

        // Start sub-note creation
        const startSubResponse = await this.simulateMessage('/createsub', true);
        this.recordStep('Start sub-note creation', '/createsub', startSubResponse);
        assert(startSubResponse.includes('What should be the name'), 'Expected sub-note name prompt');

        // Provide sub-note name with auto confirm enabled
        const subNoteResponse = await this.simulateMessage('test sub-note', true);
        this.recordStep('Sub-note name with auto confirm', 'test sub-note', subNoteResponse);
        assert(subNoteResponse.includes('Sub-note created successfully'), `Expected auto-created sub-note, got: ${subNoteResponse}`);
        assert(!subNoteResponse.includes('Do you want to create a sub-note'), 'Should not ask for confirmation');
    }
}

module.exports = {
    run: async () => {
        const test = new NewAutoConfirmationTest();
        await test.run();
    }
};
