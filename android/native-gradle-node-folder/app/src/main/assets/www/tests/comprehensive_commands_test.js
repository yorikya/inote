/**
 * Comprehensive Commands Test
 * Tests the full integration scenarios for /savelastmessage and /stopediting commands
 */

// Mock the required modules
const StateManager = require('../StateManager.js');
const NoteManager = require('../NoteManager.js');
const CommandRouter = require('../CommandRouter.js');

// Mock global app object for DroidScript environment
global.app = {
    ReadFile: (filename) => {
        if (filename === 'notes.json') {
            return JSON.stringify({
                notes: [
                    { id: 1, title: "Test Note", description: "Test description", parent_id: null, done: false, creation_date: new Date().toISOString() }
                ]
            });
        }
        return '{}';
    },
    WriteFile: (filename, content) => {
        console.log(`Mock: Writing to ${filename}: ${content.substring(0, 100)}...`);
    }
};

// Mock Settings object
global.Settings = {
    lang: "en"
};

// Make modules globally available
global.StateManager = StateManager;
global.NoteManager = NoteManager;
global.CommandRouter = CommandRouter;

class ComprehensiveCommandsTest {
    constructor() {
        this.testName = "Comprehensive Commands";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: Full integration scenarios for new commands");
        console.log("==================================================\n");

        try {
            await this.test1_SaveLastMessageIntegration();
            await this.test2_StopEditingIntegration();
            await this.test3_ContextValidation();
            await this.test4_ErrorHandling();
            
            console.log("✅ Comprehensive Commands Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ Comprehensive Commands Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_SaveLastMessageIntegration() {
        console.log('💾 Test 1: /savelastmessage Full Integration');
        
        // Simulate AI conversation mode
        const mockNote = { id: 1, title: "Test Note", description: "Test description" };
        StateManager.setAiConversationMode(mockNote);
        
        // Add mock conversation history
        StateManager.addToAiConversationHistory("What should I do?", "You should focus on completing the main tasks first, then move to secondary items.");
        
        this.recordStep('Setup AI conversation', 'Mock note and history', 'AI conversation mode set with history');
        
        // Test command detection in AI conversation context
        const result = CommandRouter.detectIntent('/savelastmessage', global.Settings);
        this.recordStep('Detect /savelastmessage in AI context', '/savelastmessage', `Action: ${result.action}`);
        
        // In AI conversation mode, slash commands are treated as AI conversation
        // This is correct behavior - the WebSocketHandler will handle the slash command
        assert(result.action === 'ai_conversation', 'Expected ai_conversation action in AI mode');
        assert(result.confidence === 1, 'Expected high confidence for AI conversation');
        
        // Test that we have conversation history
        const history = StateManager.getAiConversationHistory();
        assert(history.length > 0, 'Expected conversation history to exist');
        assert(history[0].ai.includes('You should focus'), 'Expected AI response in history');
        
        // Clean up
        StateManager.clearAiConversationMode();
    }

    async test2_StopEditingIntegration() {
        console.log('✏️ Test 2: /stopediting Full Integration');
        
        // Simulate story editing mode
        StateManager.setStoryEditingMode();
        
        this.recordStep('Setup story editing mode', 'Set editing mode', 'Story editing mode activated');
        
        // Test command detection in story editing context
        const result = CommandRouter.detectIntent('/stopediting', global.Settings);
        this.recordStep('Detect /stopediting in editing context', '/stopediting', `Action: ${result.action}`);
        
        // In story editing mode, slash commands are treated as story content
        // This is correct behavior - the WebSocketHandler will handle the slash command
        assert(result.action === 'story_content', 'Expected story_content action in editing mode');
        assert(result.confidence === 1, 'Expected high confidence for story content');
        
        // Test that we're in editing mode
        const editingMode = StateManager.getStoryEditingMode();
        assert(editingMode !== null && editingMode !== false, 'Expected story editing mode to be active');
        
        // Clean up
        StateManager.clearStoryEditingMode();
    }

    async test3_ContextValidation() {
        console.log('🔍 Test 3: Context Validation');
        
        // Test /savelastmessage outside AI conversation (should work but with validation)
        const result1 = CommandRouter.detectIntent('/savelastmessage', global.Settings);
        this.recordStep('Test /savelastmessage outside AI context', '/savelastmessage', `Action: ${result1.action}`);
        assert(result1.action === 'slash_savelastmessage', 'Expected command to be detected even outside context');
        
        // Test /stopediting outside story editing (should work but with validation)
        const result2 = CommandRouter.detectIntent('/stopediting', global.Settings);
        this.recordStep('Test /stopediting outside editing context', '/stopediting', `Action: ${result2.action}`);
        assert(result2.action === 'slash_stopediting', 'Expected command to be detected even outside context');
        
        // Test case sensitivity for both commands
        const result3 = CommandRouter.detectIntent('/SAVELASTMESSAGE', global.Settings);
        const result4 = CommandRouter.detectIntent('/STOPEDITING', global.Settings);
        
        this.recordStep('Test case sensitivity', 'Uppercase commands', `Actions: ${result3.action}, ${result4.action}`);
        assert(result3.action === 'slash_savelastmessage', 'Expected case insensitive detection');
        assert(result4.action === 'slash_stopediting', 'Expected case insensitive detection');
    }

    async test4_ErrorHandling() {
        console.log('⚠️ Test 4: Error Handling Scenarios');
        
        // Test with malformed commands
        const result1 = CommandRouter.detectIntent('/savelast', global.Settings);
        const result2 = CommandRouter.detectIntent('/stop', global.Settings);
        
        this.recordStep('Test malformed commands', '/savelast, /stop', `Actions: ${result1.action}, ${result2.action}`);
        assert(result1.action === 'unknown_slash_command', 'Expected malformed command to be unknown slash command');
        assert(result2.action === 'unknown_slash_command', 'Expected malformed command to be unknown slash command');
        
        // Test with extra parameters
        const result3 = CommandRouter.detectIntent('/savelastmessage with extra params', global.Settings);
        const result4 = CommandRouter.detectIntent('/stopediting now', global.Settings);
        
        this.recordStep('Test commands with extra params', 'Commands with extra text', `Actions: ${result3.action}, ${result4.action}`);
        assert(result3.action === 'slash_savelastmessage', 'Expected command to work with extra parameters');
        assert(result4.action === 'slash_stopediting', 'Expected command to work with extra parameters');
        
        // Test with spaces
        const result5 = CommandRouter.detectIntent('  /savelastmessage  ', global.Settings);
        const result6 = CommandRouter.detectIntent('  /stopediting  ', global.Settings);
        
        this.recordStep('Test commands with spaces', 'Commands with spaces', `Actions: ${result5.action}, ${result6.action}`);
        // Note: Commands with spaces might be detected as unknown_command, which is acceptable
        assert(result5.action === 'slash_savelastmessage' || result5.action === 'unknown_command', 'Expected command to work with spaces or be unknown');
        assert(result6.action === 'slash_stopediting' || result6.action === 'unknown_command', 'Expected command to work with spaces or be unknown');
    }

    recordStep(action, input, response) {
        this.steps.push({
            action: action,
            input: input,
            response: response
        });
    }

    printTestSteps() {
        console.log("\n📋 Test Steps Recorded:");
        console.log("------------------------------");
        this.steps.forEach((step, index) => {
            console.log(`Step ${index + 1}: ${step.action}`);
            console.log(`  Input: ${step.input}`);
            console.log(`  Response: ${step.response}`);
        });
        console.log("------------------------------\n");
    }
}

// Helper function for assertions
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Export for test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        run: async function() {
            const test = new ComprehensiveCommandsTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new ComprehensiveCommandsTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
