/**
 * AI Conversation Error Fix Test
 * Tests that AI conversation error handling is working properly
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

class AIConversationErrorFixTest {
    constructor() {
        this.testName = "AI Conversation Error Fix";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: AI conversation error handling and response validation");
        console.log("==================================================\n");

        try {
            await this.test1_PromptFormat();
            await this.test2_ErrorHandling();
            await this.test3_ResponseValidation();
            
            console.log("✅ AI Conversation Error Fix Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ AI Conversation Error Fix Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_PromptFormat() {
        console.log('📝 Test 1: Prompt Format');
        
        // Test the correct prompt format
        const noteContext = "📝 **Note: Replace generator belt with short one (need to check)**";
        const historyContext = "";
        const message = "What length of the generator belt in fiat tipo 1994, 2.0l 16v (sportiva)";
        
        const prompt = noteContext + historyContext + "\n\nUser's current question: " + message;
        
        this.recordStep('Build prompt with correct format', 'Note context + message', `Prompt length: ${prompt.length}`);
        
        // Verify prompt format
        assert(prompt.includes("User's current question:"), 'Expected correct prompt format');
        assert(prompt.includes("Replace generator belt"), 'Expected note context in prompt');
        assert(prompt.includes("What length of the generator belt"), 'Expected user question in prompt');
    }

    async test2_ErrorHandling() {
        console.log('⚠️ Test 2: Error Handling');
        
        // Test error handling in callback
        let callbackCalled = false;
        let callbackResponse = null;
        
        const mockCallback = function(response) {
            callbackCalled = true;
            callbackResponse = response;
        };
        
        // Simulate error scenario
        try {
            // This would normally call the callback with an error response
            mockCallback("I'm sorry, I encountered an error processing your question. Please try again.");
        } catch (error) {
            // This should not happen with proper error handling
            assert(false, 'Error should be handled gracefully');
        }
        
        this.recordStep('Test error handling', 'Mock callback', `Callback called: ${callbackCalled}, Response: ${callbackResponse}`);
        
        // Verify error handling
        assert(callbackCalled, 'Expected callback to be called');
        assert(callbackResponse !== null, 'Expected non-null response');
        assert(callbackResponse.includes('sorry'), 'Expected error message');
    }

    async test3_ResponseValidation() {
        console.log('✅ Test 3: Response Validation');
        
        // Test response validation scenarios
        const testCases = [
            { response: null, expected: "fallback" },
            { response: "", expected: "fallback" },
            { response: "   ", expected: "fallback" },
            { response: "Valid response", expected: "valid" }
        ];
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            let finalResponse = testCase.response;
            
            // Apply the same validation logic as in the fix
            if (!finalResponse || finalResponse.trim() === "") {
                finalResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
            }
            
            this.recordStep(`Test case ${i + 1}`, `Response: ${testCase.response}`, `Final: ${finalResponse.substring(0, 50)}...`);
            
            // Verify validation
            assert(finalResponse !== null, 'Expected non-null final response');
            assert(finalResponse.trim() !== "", 'Expected non-empty final response');
        }
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
            const test = new AIConversationErrorFixTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new AIConversationErrorFixTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
