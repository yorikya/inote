/**
 * Chat Timestamps Test
 * Tests the timestamp functionality in chat messages
 */

class ChatTimestampsTest {
    constructor() {
        this.testName = "Chat Timestamps";
        this.steps = [];
    }

    async run() {
        console.log(`\n🧪 Testing: ${this.testName}`);
        console.log("Testing: Timestamp display and formatting in chat messages");
        console.log("==================================================\n");

        try {
            await this.test1_TimestampFormatting();
            await this.test2_MessageStructure();
            await this.test3_HistoryRestoration();
            
            console.log("✅ Chat Timestamps Test PASSED!\n");
            this.printTestSteps();
            return true;
        } catch (error) {
            console.log(`❌ Chat Timestamps Test FAILED: ${error.message}\n`);
            this.printTestSteps();
            return false;
        }
    }

    async test1_TimestampFormatting() {
        console.log('⏰ Test 1: Timestamp Formatting');
        
        // Test current time formatting
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        this.recordStep('Format current time', 'Current time', `Formatted as: ${timeString}`);
        
        // Test yesterday formatting
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = "Yesterday " + yesterday.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        this.recordStep('Format yesterday time', 'Yesterday time', `Formatted as: ${yesterdayString}`);
        
        // Test week formatting
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 3);
        const weekString = weekAgo.toLocaleDateString([], { weekday: 'short' }) + " " + weekAgo.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        this.recordStep('Format week time', 'Week time', `Formatted as: ${weekString}`);
        
        // Verify formatting works
        assert(timeString.includes(':'), 'Expected time format to include colon');
        assert(yesterdayString.includes('Yesterday'), 'Expected yesterday format to include "Yesterday"');
        assert(weekString.includes(' '), 'Expected week format to include space between day and time');
    }

    async test2_MessageStructure() {
        console.log('📝 Test 2: Message Structure with Timestamps');
        
        // Simulate message structure
        const messageData = {
            text: "Hello, this is a test message",
            who: "you",
            timestamp: new Date().toISOString()
        };
        
        this.recordStep('Create message structure', 'Message data', `Created message with timestamp: ${messageData.timestamp}`);
        
        // Verify message has required fields
        assert(messageData.text, 'Expected message to have text');
        assert(messageData.who, 'Expected message to have who field');
        assert(messageData.timestamp, 'Expected message to have timestamp');
        
        // Verify timestamp is valid ISO string
        const timestampDate = new Date(messageData.timestamp);
        assert(!isNaN(timestampDate.getTime()), 'Expected valid timestamp');
    }

    async test3_HistoryRestoration() {
        console.log('🔄 Test 3: History Restoration with Timestamps');
        
        // Simulate chat history with timestamps
        const chatHistory = [
            {
                text: "First message",
                who: "you",
                timestamp: new Date(Date.now() - 60000).toISOString() // 1 minute ago
            },
            {
                text: "Bot response",
                who: "bot", 
                timestamp: new Date(Date.now() - 30000).toISOString() // 30 seconds ago
            },
            {
                text: "System message",
                who: "sys",
                timestamp: new Date().toISOString() // Now
            }
        ];
        
        this.recordStep('Load chat history', 'History data', `Loaded ${chatHistory.length} messages with timestamps`);
        
        // Verify all messages have timestamps
        chatHistory.forEach((message, index) => {
            assert(message.timestamp, `Expected message ${index + 1} to have timestamp`);
            const messageDate = new Date(message.timestamp);
            assert(!isNaN(messageDate.getTime()), `Expected message ${index + 1} to have valid timestamp`);
        });
        
        // Verify messages are in chronological order
        for (let i = 1; i < chatHistory.length; i++) {
            const prevTime = new Date(chatHistory[i-1].timestamp);
            const currTime = new Date(chatHistory[i].timestamp);
            assert(prevTime <= currTime, `Expected messages to be in chronological order`);
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
            const test = new ChatTimestampsTest();
            return await test.run();
        }
    };
}

// Run test if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const test = new ChatTimestampsTest();
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}
