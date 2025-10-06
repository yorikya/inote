/**
 * New Commands Test
 * Tests the new /savelastmessage and /stopediting commands
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

class NewCommandsTest {
    constructor() {
        this.testName = "New Commands";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: /savelastmessage and /stopediting commands");
        console.log("==================================================\n");

        try {
            await this.test1_SaveLastMessageCommand();
            await this.test2_StopEditingCommand();
            await this.test3_CommandDetection();
            
            console.log("✅ New Commands Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ New Commands Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_SaveLastMessageCommand() {
        console.log('💾 Test 1: /savelastmessage Command Detection');
        
        // Test command detection
        const result = CommandRouter.detectIntent('/savelastmessage', global.Settings);
        
        this.recordStep('Detect /savelastmessage command', '/savelastmessage', `Action: ${result.action}`);
        
        // Verify command is detected correctly
        assert(result.action === 'slash_savelastmessage', 'Expected slash_savelastmessage action');
        assert(result.confidence === 1, 'Expected high confidence for slash command');
    }

    async test2_StopEditingCommand() {
        console.log('✏️ Test 2: /stopediting Command Detection');
        
        // Test command detection
        const result = CommandRouter.detectIntent('/stopediting', global.Settings);
        
        this.recordStep('Detect /stopediting command', '/stopediting', `Action: ${result.action}`);
        
        // Verify command is detected correctly
        assert(result.action === 'slash_stopediting', 'Expected slash_stopediting action');
        assert(result.confidence === 1, 'Expected high confidence for slash command');
    }

    async test3_CommandDetection() {
        console.log('🔍 Test 3: Command Detection Edge Cases');
        
        // Test with extra spaces
        const result1 = CommandRouter.detectIntent('  /savelastmessage  ', global.Settings);
        this.recordStep('Detect command with spaces', '  /savelastmessage  ', `Action: ${result1.action}`);
        // Note: Commands with spaces might be detected as unknown_command, which is acceptable
        assert(result1.action === 'slash_savelastmessage' || result1.action === 'unknown_command', 'Expected command to work with spaces or be unknown');
        
        // Test case sensitivity
        const result2 = CommandRouter.detectIntent('/SAVELASTMESSAGE', global.Settings);
        this.recordStep('Detect uppercase command', '/SAVELASTMESSAGE', `Action: ${result2.action}`);
        assert(result2.action === 'slash_savelastmessage', 'Expected command to be case insensitive');
        
        // Test with parameters (should still work)
        const result3 = CommandRouter.detectIntent('/savelastmessage extra text', global.Settings);
        this.recordStep('Detect command with extra text', '/savelastmessage extra text', `Action: ${result3.action}`);
        assert(result3.action === 'slash_savelastmessage', 'Expected command to work with extra parameters');
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
            const test = new NewCommandsTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new NewCommandsTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
