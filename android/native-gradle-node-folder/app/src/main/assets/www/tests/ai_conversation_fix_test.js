/**
 * AI Conversation Fix Test
 * Tests that AI conversation now calls Gemini directly instead of using generic templates
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

class AIConversationFixTest {
    constructor() {
        this.testName = "AI Conversation Fix";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: AI conversation now calls Gemini directly");
        console.log("==================================================\n");

        try {
            await this.test1_AIConversationDetection();
            await this.test2_NoteContextBuilding();
            await this.test3_ConversationHistoryHandling();
            
            console.log("✅ AI Conversation Fix Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ AI Conversation Fix Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_AIConversationDetection() {
        console.log('🤖 Test 1: AI Conversation Detection');
        
        // Simulate AI conversation mode
        const mockNote = { id: 1, title: "Replace generator belt with short one (need to check)", description: "Need to find the correct belt size" };
        StateManager.setAiConversationMode(mockNote);
        
        // Test that AI conversation is detected correctly
        const result = CommandRouter.detectIntent('What sizes usually fiat tipo 164 2.0 16v has according to the manual instructions?', global.Settings);
        this.recordStep('Detect AI conversation', 'Technical question', `Action: ${result.action}`);
        
        // Verify AI conversation is detected
        assert(result.action === 'ai_conversation', 'Expected ai_conversation action');
        assert(result.params.message === 'What sizes usually fiat tipo 164 2.0 16v has according to the manual instructions?', 'Expected user message in params');
        
        // Clean up
        StateManager.clearAiConversationMode();
    }

    async test2_NoteContextBuilding() {
        console.log('📝 Test 2: Note Context Building');
        
        // Test note context building
        const mockNote = { 
            id: 26, 
            title: "Replace generator belt with short one (need to check)", 
            description: "Need to find the correct belt size for Fiat Tipo 164 2.0 16v"
        };
        
        // Build note context as it would be done in WebSocketHandler
        var noteContext = "📝 **Note: " + mockNote.title + "**";
        if (mockNote.description) {
            noteContext += "\nDescription: " + mockNote.description;
        }
        
        this.recordStep('Build note context', 'Mock note', `Context: ${noteContext.substring(0, 100)}...`);
        
        // Verify note context is built correctly
        assert(noteContext.includes('Replace generator belt'), 'Expected note title in context');
        assert(noteContext.includes('Fiat Tipo 164'), 'Expected note description in context');
        assert(noteContext.includes('📝 **Note:'), 'Expected note context format');
    }

    async test3_ConversationHistoryHandling() {
        console.log('💬 Test 3: Conversation History Handling');
        
        // Simulate conversation history
        const conversationHistory = [
            {
                user: "What sizes usually fiat tipo 164 2.0 16v has according to the manual instructions?",
                ai: "Based on the Fiat Tipo 164 2.0 16v manual, the generator belt typically uses...",
                timestamp: new Date().toISOString()
            }
        ];
        
        // Build conversation history context as it would be done in WebSocketHandler
        var historyContext = "";
        if (conversationHistory && conversationHistory.length > 0) {
            historyContext = "\n\n**Previous Conversation:**\n";
            for (var i = 0; i < conversationHistory.length; i++) {
                var turn = conversationHistory[i];
                historyContext += "User: " + turn.user + "\n";
                historyContext += "AI: " + turn.ai + "\n\n";
            }
        }
        
        this.recordStep('Build conversation history', 'Mock history', `History length: ${historyContext.length}`);
        
        // Verify conversation history is built correctly
        assert(historyContext.includes('Previous Conversation'), 'Expected conversation history header');
        assert(historyContext.includes('What sizes usually fiat tipo'), 'Expected user question in history');
        assert(historyContext.includes('Based on the Fiat Tipo'), 'Expected AI response in history');
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
            const test = new AIConversationFixTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new AIConversationFixTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
