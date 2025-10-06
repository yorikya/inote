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

const StateManager = require('../StateManager');
const NoteManager = require('../NoteManager');
const CommandRouter = require('../CommandRouter');

// Make modules available globally
global.StateManager = StateManager;
global.NoteManager = NoteManager;
global.CommandRouter = CommandRouter;

class SimpleAutoConfirmationTest {
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

    async run() {
        console.log('🧪 Testing: Simple Auto Confirmation System');
        console.log('Testing: Command detection and state management');
        console.log('='.repeat(50));

        // Clear all states before starting
        StateManager.clearAllStates();
        NoteManager.clearAllNotes();

        try {
            // Test 1: Check initial state
            await this.test1_InitialState();

            // Test 2: Test command detection
            await this.test2_CommandDetection();

            // Test 3: Test state management
            await this.test3_StateManagement();

            console.log('✅ Simple Auto Confirmation Test PASSED!');
            this.printTestSteps();

        } catch (error) {
            console.log('❌ Simple Auto Confirmation Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async test1_InitialState() {
        console.log('\n🔍 Test 1: Initial State');
        this.recordStep('Check initial state', 'Initial state', 'All states cleared');
        assert.strictEqual(StateManager.getCurrentFindContext(), null, 'Initial find context should be null');
        assert.strictEqual(StateManager.getPendingNoteCreation(), null, 'Initial pending note creation should be null');
    }

    async test2_CommandDetection() {
        console.log('\n⚙️ Test 2: Command Detection');
        
        // Test auto confirm on command
        const onResult = CommandRouter.detectIntent('/autoconfirmon', { lang: 'en' });
        this.recordStep('Detect auto confirm on', '/autoconfirmon', onResult);
        assert.strictEqual(onResult.action, 'slash_auto_confirm_on', `Expected slash_auto_confirm_on, got: ${onResult.action}`);

        // Test auto confirm off command
        const offResult = CommandRouter.detectIntent('/autoconfirmoff', { lang: 'en' });
        this.recordStep('Detect auto confirm off', '/autoconfirmoff', offResult);
        assert.strictEqual(offResult.action, 'slash_auto_confirm_off', `Expected slash_auto_confirm_off, got: ${offResult.action}`);

        // Test natural language commands
        const naturalOnResult = CommandRouter.detectIntent('enable auto confirm', { lang: 'en' });
        this.recordStep('Detect natural language on', 'enable auto confirm', naturalOnResult);
        assert.strictEqual(naturalOnResult.action, 'auto_confirm_on', `Expected auto_confirm_on, got: ${naturalOnResult.action}`);

        const naturalOffResult = CommandRouter.detectIntent('disable auto confirm', { lang: 'en' });
        this.recordStep('Detect natural language off', 'disable auto confirm', naturalOffResult);
        assert.strictEqual(naturalOffResult.action, 'auto_confirm_off', `Expected auto_confirm_off, got: ${naturalOffResult.action}`);
    }

    async test3_StateManagement() {
        console.log('\n📝 Test 3: State Management');
        
        // Test setting pending note creation
        StateManager.setPendingNoteCreation('Test Note', null);
        this.recordStep('Set pending note creation', 'Test note', 'Set');
        
        const pendingNote = StateManager.getPendingNoteCreation();
        assert(pendingNote !== null, 'Pending note creation should be set');
        assert.strictEqual(pendingNote.title, 'Test Note', 'Pending note title should match');
        
        // Test clearing pending note creation
        StateManager.clearPendingNoteCreation();
        this.recordStep('Clear pending note creation', 'Clear', 'Cleared');
        
        const clearedNote = StateManager.getPendingNoteCreation();
        assert.strictEqual(clearedNote, null, 'Pending note creation should be cleared');
        
        // Test setting pending sub-note creation
        StateManager.setPendingSubNoteCreation('1');
        this.recordStep('Set pending sub-note creation', 'Test sub-note', 'Set');
        
        const pendingSubNote = StateManager.getPendingSubNoteCreation();
        assert(pendingSubNote !== null, 'Pending sub-note creation should be set');
        assert.strictEqual(pendingSubNote.parentNoteId, '1', 'Parent note ID should match');
        
        // Test clearing all states
        StateManager.clearAllStates();
        this.recordStep('Clear all states', 'Clear all', 'All cleared');
        
        assert.strictEqual(StateManager.getPendingNoteCreation(), null, 'All states should be cleared');
        assert.strictEqual(StateManager.getPendingSubNoteCreation(), null, 'All states should be cleared');
    }
}

module.exports = {
    run: async () => {
        const test = new SimpleAutoConfirmationTest();
        await test.run();
    }
};
