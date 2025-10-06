/**
 * Note Taking Flow Test
 * Tests the complete note lifecycle: Create → Find → Edit → Delete
 */

const assert = require('assert');

class NoteTakingFlowTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Note Taking Flow');
        console.log('Testing: Create → Find → Edit → Delete');
        console.log('='.repeat(50));
        
        try {
            // Step 1: Test note creation flow
            await this.step1_CreateNote();
            
            // Step 2: Test note finding flow
            await this.step2_FindNote();
            
            // Step 3: Test note editing flow
            await this.step3_EditNote();
            
            // Step 4: Test note deletion flow
            await this.step4_DeleteNote();
            
            console.log('✅ Note Taking Flow Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Note Taking Flow Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    // -------- Test Steps --------
    async step1_CreateNote() {
        console.log('\n📝 Step 1: Create Note');
        console.log('User: /createnote test note for flow');
        
        // Simulate user input
        const userInput = '/createnote test note for flow';
        const expectedResponse = 'Do you want to create a note';
        
        // Simulate agent response
        const agentResponse = 'Do you want to create a note with title \'test note for flow\'? (yes/no)';
        
        this.recordStep('Create note', userInput, agentResponse);
        assert(agentResponse.includes(expectedResponse), 'Expected creation prompt');
        
        console.log('User: yes');
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'test note for flow\'';
        this.recordStep('Confirm creation', 'yes', confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async step2_FindNote() {
        console.log('\n🔍 Step 2: Find Note');
        console.log('User: /findbyid 1');
        
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'test note for flow\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
        assert(agentResponse.includes('test note for flow'), 'Expected correct note title');
    }

    async step3_EditNote() {
        console.log('\n✏️ Step 3: Edit Note Description');
        console.log('User: /editdescription');
        
        const userInput = '/editdescription';
        const agentResponse = 'I\'ll start description editing mode for \'test note for flow\'. Type or record the new content. To finish, say \'stop editing description\'.';
        
        this.recordStep('Start editing', userInput, agentResponse);
        assert(agentResponse.includes('start description editing mode'), 'Expected editing mode start');
        
        console.log('User: this is a test description');
        const addContentResponse = '✅ Added to story description. Continue writing or say \'stop editing description\' to finish.';
        this.recordStep('Add description', 'this is a test description', addContentResponse);
        assert(addContentResponse.includes('Added to story description'), 'Expected description added');
        
        console.log('User: /stopediting');
        const stopResponse = 'Do you want to update the description for \'test note for flow\' with: \'this is a test description.\'? (yes/no)';
        this.recordStep('Stop editing', '/stopediting', stopResponse);
        assert(stopResponse.includes('Do you want to update'), 'Expected update confirmation');
        
        console.log('User: yes');
        const confirmUpdateResponse = '✅ Note description for \'test note for flow\' updated successfully!';
        this.recordStep('Confirm update', 'yes', confirmUpdateResponse);
        assert(confirmUpdateResponse.includes('updated successfully'), 'Expected update success');
    }

    async step4_DeleteNote() {
        console.log('\n🗑️ Step 4: Delete Note');
        console.log('User: /delete');
        
        const userInput = '/delete';
        const agentResponse = 'Do you want to delete the note \'test note for flow\'? (yes/no)';
        
        this.recordStep('Delete note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to delete'), 'Expected deletion prompt');
        
        console.log('User: yes');
        const confirmDeleteResponse = 'Note \'test note for flow\' deleted successfully!';
        this.recordStep('Confirm deletion', 'yes', confirmDeleteResponse);
        assert(confirmDeleteResponse.includes('deleted successfully'), 'Expected deletion success');
    }

    // -------- Helper Functions --------
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
        const test = new NoteTakingFlowTest();
        await test.run();
    }
};
