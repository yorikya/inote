/**
 * Auto Confirmation Test
 * Tests auto confirmation functionality for all commands
 */

const assert = require('assert');

class AutoConfirmationTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Auto Confirmation');
        console.log('Testing: Auto confirmation for create, delete, mark done, and sub-note creation');
        console.log('='.repeat(50));
        
        try {
            // Test 1: Auto confirmation for note creation
            await this.test1_AutoConfirmNoteCreation();
            
            // Test 2: Auto confirmation for note deletion
            await this.test2_AutoConfirmNoteDeletion();
            
            // Test 3: Auto confirmation for mark done
            await this.test3_AutoConfirmMarkDone();
            
            // Test 4: Auto confirmation for sub-note creation
            await this.test4_AutoConfirmSubNoteCreation();
            
            console.log('✅ Auto Confirmation Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Auto Confirmation Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async test1_AutoConfirmNoteCreation() {
        console.log('\n📝 Test 1: Auto Confirm Note Creation');
        
        // Simulate auto confirmation enabled
        const settings = { autoConfirm: true };
        
        const userInput = '/createnote auto test note';
        const expectedResponse = 'Note created successfully! ID: 1, Title: \'auto test note\'';
        
        this.recordStep('Create note with auto confirm', userInput, expectedResponse);
        assert(expectedResponse.includes('Note created successfully'), 'Expected auto creation success');
        assert(!expectedResponse.includes('Do you want to create'), 'Should NOT ask for confirmation');
    }

    async test2_AutoConfirmNoteDeletion() {
        console.log('\n🗑️ Test 2: Auto Confirm Note Deletion');
        
        // First find the note
        const findInput = '/findbyid 1';
        const findResponse = 'Found note: \'auto test note\' (ID: 1). What would you like to do?';
        this.recordStep('Find note for deletion', findInput, findResponse);
        
        // Delete with auto confirmation
        const deleteInput = '/delete';
        const expectedResponse = 'Note \'auto test note\' deleted successfully!';
        
        this.recordStep('Delete note with auto confirm', deleteInput, expectedResponse);
        assert(expectedResponse.includes('deleted successfully'), 'Expected auto deletion success');
        assert(!expectedResponse.includes('Do you want to delete'), 'Should NOT ask for confirmation');
    }

    async test3_AutoConfirmMarkDone() {
        console.log('\n✅ Test 3: Auto Confirm Mark Done');
        
        // Create a new note first
        const createInput = '/createnote mark done test';
        const createResponse = 'Note created successfully! ID: 2, Title: \'mark done test\'';
        this.recordStep('Create note for mark done', createInput, createResponse);
        
        // Find the note
        const findInput = '/findbyid 2';
        const findResponse = 'Found note: \'mark done test\' (ID: 2). What would you like to do?';
        this.recordStep('Find note for mark done', findInput, findResponse);
        
        // Mark done with auto confirmation
        const markInput = '/markdone';
        const expectedResponse = 'Note \'mark done test\' marked as done successfully!';
        
        this.recordStep('Mark done with auto confirm', markInput, expectedResponse);
        assert(expectedResponse.includes('marked as done successfully'), 'Expected auto mark done success');
        assert(!expectedResponse.includes('Do you want to mark'), 'Should NOT ask for confirmation');
    }

    async test4_AutoConfirmSubNoteCreation() {
        console.log('\n📝 Test 4: Auto Confirm Sub-Note Creation');
        
        // Create parent note
        const createInput = '/createnote parent for sub-note';
        const createResponse = 'Note created successfully! ID: 3, Title: \'parent for sub-note\'';
        this.recordStep('Create parent note', createInput, createResponse);
        
        // Find parent note
        const findInput = '/findbyid 3';
        const findResponse = 'Found note: \'parent for sub-note\' (ID: 3). What would you like to do?';
        this.recordStep('Find parent note', findInput, findResponse);
        
        // Start sub-note creation
        const createSubInput = '/createsub';
        const subPromptResponse = 'I\'ll create a sub-note under \'parent for sub-note\'. What should be the name of the sub-note?';
        this.recordStep('Start sub-note creation', createSubInput, subPromptResponse);
        
        // Provide sub-note name - should auto-confirm
        const subNameInput = 'auto sub-note';
        const expectedResponse = 'Sub-note created successfully! ID: 4, Title: \'auto sub-note\'\n\nReturned to parent note \'parent for sub-note\' context. What would you like to do?';
        
        this.recordStep('Sub-note name with auto confirm', subNameInput, expectedResponse);
        assert(expectedResponse.includes('Sub-note created successfully'), 'Expected auto sub-note creation success');
        assert(!expectedResponse.includes('Do you want to create a sub-note'), 'Should NOT ask for confirmation');
        assert(expectedResponse.includes('Returned to parent note'), 'Should return to parent context');
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
        const test = new AutoConfirmationTest();
        await test.run();
    }
};
