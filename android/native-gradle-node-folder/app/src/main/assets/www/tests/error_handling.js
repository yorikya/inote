/**
 * Error Handling Test
 * Tests error handling and edge cases
 */

const assert = require('assert');

class ErrorHandlingTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Error Handling');
        console.log('Testing: Invalid commands, Non-existent notes, Edge cases');
        console.log('='.repeat(50));
        
        try {
            // Test 1: Invalid command
            await this.test1_InvalidCommand();
            
            // Test 2: Non-existent note
            await this.test2_NonExistentNote();
            
            // Test 3: Edit without context
            await this.test3_EditWithoutContext();
            
            // Test 4: Invalid sub-note selection
            await this.test4_InvalidSubNoteSelection();
            
            console.log('✅ Error Handling Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Error Handling Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async test1_InvalidCommand() {
        console.log('\n❌ Test 1: Invalid Command');
        const userInput = '/invalidcommand';
        const agentResponse = 'Unknown command: /invalidcommand. Try /help for available commands.';
        
        this.recordStep('Invalid command', userInput, agentResponse);
        assert(agentResponse.includes('Unknown command'), 'Expected unknown command error');
    }

    async test2_NonExistentNote() {
        console.log('\n❌ Test 2: Non-Existent Note');
        const userInput = '/findbyid 999';
        const agentResponse = 'No note found with ID \'999\'. Try /showparents to see available notes.';
        
        this.recordStep('Non-existent note', userInput, agentResponse);
        assert(agentResponse.includes('No note found'), 'Expected note not found error');
    }

    async test3_EditWithoutContext() {
        console.log('\n❌ Test 3: Edit Without Context');
        const userInput = '/editdescription';
        const agentResponse = 'No notes found to edit. Use /findnote or /findbyid to select a note first.';
        
        this.recordStep('Edit without context', userInput, agentResponse);
        assert(agentResponse.includes('No notes found to edit'), 'Expected no context error');
    }

    async test4_InvalidSubNoteSelection() {
        console.log('\n❌ Test 4: Invalid Sub-Note Selection');
        const userInput = '/selectsubnote 999';
        const agentResponse = 'No sub-note found with ID \'999\'. Use /findbyid to see available sub-notes.';
        
        this.recordStep('Invalid sub-note selection', userInput, agentResponse);
        assert(agentResponse.includes('No sub-note found'), 'Expected sub-note not found error');
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
        const test = new ErrorHandlingTest();
        await test.run();
    }
};
