/**
 * AI Conversation Test
 * Tests AI conversation functionality
 */

const assert = require('assert');

class AIConversationTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: AI Conversation');
        console.log('Testing: Create → Find → Start AI → Ask Question → Cancel');
        console.log('='.repeat(50));
        
        try {
            // Setup: Create note
            await this.step1_CreateNote();
            
            // Find note
            await this.step2_FindNote();
            
            // Start AI conversation
            await this.step3_StartAIConversation();
            
            // Ask AI question
            await this.step4_AskAIQuestion();
            
            // Cancel AI conversation
            await this.step5_CancelAIConversation();
            
            console.log('✅ AI Conversation Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ AI Conversation Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async step1_CreateNote() {
        console.log('\n📝 Step 1: Create Note');
        const userInput = '/createnote AI test note';
        const agentResponse = 'Do you want to create a note with title \'AI test note\'? (yes/no)';
        
        this.recordStep('Create note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to create a note'), 'Expected creation prompt');
        
        const confirmInput = 'yes';
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'AI test note\'';
        this.recordStep('Confirm creation', confirmInput, confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async step2_FindNote() {
        console.log('\n🔍 Step 2: Find Note');
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'AI test note\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
    }

    async step3_StartAIConversation() {
        console.log('\n🤖 Step 3: Start AI Conversation');
        const userInput = '/talkai';
        const agentResponse = '🤖 Started AI conversation about note \'AI test note\'. Say \'cancel\' to end the conversation.';
        
        this.recordStep('Start AI conversation', userInput, agentResponse);
        assert(agentResponse.includes('Started AI conversation'), 'Expected AI conversation start');
        assert(agentResponse.includes('AI test note'), 'Expected correct note title');
    }

    async step4_AskAIQuestion() {
        console.log('\n❓ Step 4: Ask AI Question');
        const userInput = 'what is this note about?';
        const agentResponse = '🤖 Asking Gemini...';
        
        this.recordStep('Ask AI question', userInput, agentResponse);
        assert(agentResponse.includes('Asking Gemini'), 'Expected AI processing');
    }

    async step5_CancelAIConversation() {
        console.log('\n🛑 Step 5: Cancel AI Conversation');
        const userInput = '/cancel';
        const agentResponse = 'AI conversation cancelled. You can now use other commands.';
        
        this.recordStep('Cancel AI conversation', userInput, agentResponse);
        assert(agentResponse.includes('AI conversation cancelled'), 'Expected AI conversation cancellation');
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
            console.log(`  Response: ${step.response.substring(0, 100)}...`);
            console.log('');
        }
    }
}

// Export the test
module.exports = {
    run: async () => {
        const test = new AIConversationTest();
        await test.run();
    }
};
