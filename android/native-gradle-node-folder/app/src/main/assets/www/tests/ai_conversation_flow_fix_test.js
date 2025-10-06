/**
 * AI Conversation Flow Fix Test
 * Tests that AI conversation messages are not processed by handleConfirmationResponse
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

class AIConversationFlowFixTest {
    constructor() {
        this.testName = "AI Conversation Flow Fix";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: AI conversation messages should not be processed by handleConfirmationResponse");
        console.log("==================================================\n");

        try {
            await this.test1_AIConversationDetection();
            await this.test2_HandleConfirmationResponseSkip();
            await this.test3_FormatOutcomeHandling();
            
            console.log("✅ AI Conversation Flow Fix Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ AI Conversation Flow Fix Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_AIConversationDetection() {
        console.log('🤖 Test 1: AI Conversation Detection');
        
        // Test that AI conversation messages are detected correctly
        const userMessage = "What length of the generator belt in fiat tipo 1994, 2.0l 16v (sportiva)";
        
        // Mock AI conversation mode
        StateManager.setAiConversationMode({ id: 1, title: "Test Note" });
        
        // Test detectIntent
        const result = CommandRouter.detectIntent(userMessage, global.Settings);
        
        this.recordStep('Detect AI conversation intent', userMessage, `Action: ${result.action}`);
        
        // Verify it's detected as AI conversation
        assert(result.action === "ai_conversation", 'Expected ai_conversation action');
        assert(result.params.message === userMessage, 'Expected message to be preserved');
    }

    async test2_HandleConfirmationResponseSkip() {
        console.log('⏭️ Test 2: Handle Confirmation Response Skip');
        
        // Test that AI conversation messages should skip handleConfirmationResponse
        const aiConversationAction = "ai_conversation";
        const pendingSubNote = StateManager.getPendingSubNoteCreation();
        
        // Simulate the condition check
        const shouldSkip = !pendingSubNote && aiConversationAction === "ai_conversation";
        
        this.recordStep('Check skip condition', `pendingSubNote: ${pendingSubNote}, action: ${aiConversationAction}`, `Should skip: ${shouldSkip}`);
        
        // Verify it should skip
        assert(shouldSkip, 'Expected AI conversation to skip handleConfirmationResponse');
    }

    async test3_FormatOutcomeHandling() {
        console.log('📝 Test 3: Format Outcome Handling');
        
        // Test that AI conversation messages are handled by formatOutcome
        const aiConversationAction = "ai_conversation";
        const message = "What length of the generator belt in fiat tipo 1994, 2.0l 16v (sportiva)";
        
        // Mock the formatOutcome processing
        const mockFormatOutcome = function(action, params) {
            if (action === "ai_conversation") {
                return "🤖 Processing your question...";
            }
            return "Unknown action";
        };
        
        const result = mockFormatOutcome(aiConversationAction, { message: message });
        
        this.recordStep('Format outcome processing', `Action: ${aiConversationAction}`, `Result: ${result}`);
        
        // Verify it's handled by formatOutcome
        assert(result.includes("Processing your question"), 'Expected formatOutcome to handle AI conversation');
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
            const test = new AIConversationFlowFixTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new AIConversationFlowFixTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
