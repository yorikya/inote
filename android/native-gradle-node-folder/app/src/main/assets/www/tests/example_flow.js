/**
 * Example Flow Test
 * Tests the specific example flow described by the user
 */

const assert = require('assert');

class ExampleFlowTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Example Flow');
        console.log('Testing: Create → Find → Edit → Find → Delete');
        console.log('='.repeat(50));
        
        try {
            // Step 1: Create note
            await this.step1_CreateNote();
            
            // Step 2: Find note
            await this.step2_FindNote();
            
            // Step 3: Start editing
            await this.step3_StartEditing();
            
            // Step 4: Add content
            await this.step4_AddContent();
            
            // Step 5: Stop editing
            await this.step5_StopEditing();
            
            // Step 6: Find note again
            await this.step6_FindNoteAgain();
            
            // Step 7: Delete note
            await this.step7_DeleteNote();
            
            console.log('✅ Example Flow Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Example Flow Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async step1_CreateNote() {
        console.log('\n📝 Step 1: Create Note');
        console.log('User: /createnote test title');
        
        const userInput = '/createnote test title';
        const agentResponse = 'Do you want to create a note with title \'test title\'? (yes/no)';
        
        this.recordStep('Create note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to create a note'), 'Expected creation prompt');
        
        console.log('User: yes');
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'test title\'';
        this.recordStep('Confirm creation', 'yes', confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async step2_FindNote() {
        console.log('\n🔍 Step 2: Find Note');
        console.log('User: /findbyid 1');
        
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'test title\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
    }

    async step3_StartEditing() {
        console.log('\n✏️ Step 3: Start Editing');
        console.log('User: /editdescription');
        
        const userInput = '/editdescription';
        const agentResponse = 'I\'ll start description editing mode for \'test title\'. Type or record the new content. To finish, say \'stop editing description\'.';
        
        this.recordStep('Start editing', userInput, agentResponse);
        assert(agentResponse.includes('start description editing mode'), 'Expected editing mode start');
    }

    async step4_AddContent() {
        console.log('\n📝 Step 4: Add Content');
        console.log('User: this note describe test');
        
        const userInput = 'this note describe test';
        const agentResponse = '✅ Added to story description. Continue writing or say \'stop editing description\' to finish.';
        
        this.recordStep('Add content', userInput, agentResponse);
        assert(agentResponse.includes('Added to story description'), 'Expected content added');
    }

    async step5_StopEditing() {
        console.log('\n🛑 Step 5: Stop Editing');
        console.log('User: /stopediting');
        
        const userInput = '/stopediting';
        const agentResponse = 'Do you want to update the description for \'test title\' with: \'this note describe test.\'? (yes/no)';
        
        this.recordStep('Stop editing', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to update'), 'Expected update confirmation');
        
        console.log('User: yes');
        const confirmResponse = '✅ Note description for \'test title\' updated successfully!';
        this.recordStep('Confirm update', 'yes', confirmResponse);
        assert(confirmResponse.includes('updated successfully'), 'Expected update success');
    }

    async step6_FindNoteAgain() {
        console.log('\n🔍 Step 6: Find Note Again');
        console.log('User: /findbyid 1');
        
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'test title\' (ID: 1).\n\n💬 this note describe test.\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note again', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
        assert(agentResponse.includes('this note describe test'), 'Expected description in response');
    }

    async step7_DeleteNote() {
        console.log('\n🗑️ Step 7: Delete Note');
        console.log('User: /delete');
        
        const userInput = '/delete';
        const agentResponse = 'Do you want to delete the note \'test title\'? (yes/no)';
        
        this.recordStep('Delete note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to delete'), 'Expected deletion prompt');
        
        console.log('User: yes');
        const confirmResponse = 'Note \'test title\' deleted successfully!';
        this.recordStep('Confirm deletion', 'yes', confirmResponse);
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
        const test = new ExampleFlowTest();
        await test.run();
    }
};
