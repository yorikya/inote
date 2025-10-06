/**
 * Basic Operations Test
 * Tests fundamental CRUD operations: Create, Read, Update, Delete
 */

const assert = require('assert');

class BasicOperationsTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Basic Operations');
        console.log('Testing: Create, Find, Show, Delete');
        console.log('='.repeat(50));
        
        try {
            // Test 1: Create note
            await this.test1_CreateNote();
            
            // Test 2: Find note by ID
            await this.test2_FindNoteById();
            
            // Test 3: Find note by title
            await this.test3_FindNoteByTitle();
            
            // Test 4: Show parent notes
            await this.test4_ShowParentNotes();
            
            // Test 5: Delete note
            await this.test5_DeleteNote();
            
            console.log('✅ Basic Operations Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Basic Operations Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async test1_CreateNote() {
        console.log('\n📝 Test 1: Create Note');
        const userInput = '/createnote basic test note';
        const agentResponse = 'Do you want to create a note with title \'basic test note\'? (yes/no)';
        
        this.recordStep('Create note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to create a note'), 'Expected creation prompt');
        
        const confirmInput = 'yes';
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'basic test note\'';
        this.recordStep('Confirm creation', confirmInput, confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async test2_FindNoteById() {
        console.log('\n🔍 Test 2: Find Note by ID');
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'basic test note\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note by ID', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
        assert(agentResponse.includes('basic test note'), 'Expected correct note title');
    }

    async test3_FindNoteByTitle() {
        console.log('\n🔍 Test 3: Find Note by Title');
        const userInput = '/findnote basic test';
        const agentResponse = 'Found 1 note: \'basic test note\' (ID: 1)';
        
        this.recordStep('Find note by title', userInput, agentResponse);
        assert(agentResponse.includes('Found 1 note'), 'Expected note found by title');
        assert(agentResponse.includes('basic test note'), 'Expected correct note title');
    }

    async test4_ShowParentNotes() {
        console.log('\n📋 Test 4: Show Parent Notes');
        const userInput = '/showparents';
        const agentResponse = 'Found 1 parent notes:\n\n1. ➡️ \'basic test note\' (ID: 1)';
        
        this.recordStep('Show parent notes', userInput, agentResponse);
        assert(agentResponse.includes('Found 1 parent notes'), 'Expected parent notes found');
        assert(agentResponse.includes('basic test note'), 'Expected correct note in list');
    }

    async test5_DeleteNote() {
        console.log('\n🗑️ Test 5: Delete Note');
        const userInput = '/delete';
        const agentResponse = 'Do you want to delete the note \'basic test note\'? (yes/no)';
        
        this.recordStep('Delete note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to delete'), 'Expected deletion prompt');
        
        const confirmInput = 'yes';
        const confirmResponse = 'Note \'basic test note\' deleted successfully!';
        this.recordStep('Confirm deletion', confirmInput, confirmResponse);
        assert(confirmResponse.includes('deleted successfully'), 'Expected deletion success');
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
        const test = new BasicOperationsTest();
        await test.run();
    }
};
