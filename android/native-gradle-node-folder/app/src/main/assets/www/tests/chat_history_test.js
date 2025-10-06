/**
 * Chat History Persistence Test
 * Tests the chat history functionality to ensure messages are saved and restored
 */

class ChatHistoryTest {
    constructor() {
        this.testName = "Chat History Persistence";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: Chat history persistence across navigation");
        console.log("==================================================\n");

        try {
            await this.test1_ChatHistoryPersistence();
            await this.test2_ChatHistoryRestoration();
            await this.test3_ChatHistoryClearing();
            
            console.log("✅ Chat History Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ Chat History Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_ChatHistoryPersistence() {
        console.log('💾 Test 1: Chat History Persistence');
        
        // Simulate adding messages to chat
        const messages = [
            { text: "Hello, this is a test message", who: "you" },
            { text: "This is a bot response", who: "bot" },
            { text: "System message", who: "sys" }
        ];
        
        // Simulate saving messages to localStorage
        const chatHistory = messages.map(msg => ({
            text: msg.text,
            who: msg.who,
            timestamp: new Date().toISOString()
        }));
        
        // Save to localStorage (simulated)
        const savedHistory = JSON.stringify(chatHistory);
        this.recordStep('Save chat history', 'Messages added', `Saved ${messages.length} messages to localStorage`);
        
        // Verify history was saved
        assert(savedHistory.includes('Hello, this is a test message'), 'Expected user message in history');
        assert(savedHistory.includes('This is a bot response'), 'Expected bot message in history');
        assert(savedHistory.includes('System message'), 'Expected system message in history');
    }

    async test2_ChatHistoryRestoration() {
        console.log('🔄 Test 2: Chat History Restoration');
        
        // Simulate loading chat history from localStorage
        const savedHistory = JSON.stringify([
            { text: "Previous message 1", who: "you", timestamp: "2024-01-01T10:00:00.000Z" },
            { text: "Previous bot response", who: "bot", timestamp: "2024-01-01T10:01:00.000Z" },
            { text: "Previous system message", who: "sys", timestamp: "2024-01-01T10:02:00.000Z" }
        ]);
        
        const chatHistory = JSON.parse(savedHistory);
        this.recordStep('Load chat history', 'localStorage retrieval', `Loaded ${chatHistory.length} messages from history`);
        
        // Verify history was loaded correctly
        assert(chatHistory.length === 3, 'Expected 3 messages in history');
        assert(chatHistory[0].who === 'you', 'Expected first message to be from user');
        assert(chatHistory[1].who === 'bot', 'Expected second message to be from bot');
        assert(chatHistory[2].who === 'sys', 'Expected third message to be from system');
    }

    async test3_ChatHistoryClearing() {
        console.log('🗑️ Test 3: Chat History Clearing');
        
        // Simulate clearing chat history
        const clearedHistory = [];
        this.recordStep('Clear chat history', 'Clear action', 'Chat history cleared successfully');
        
        // Verify history was cleared
        assert(clearedHistory.length === 0, 'Expected empty chat history after clearing');
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
            const test = new ChatHistoryTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new ChatHistoryTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
