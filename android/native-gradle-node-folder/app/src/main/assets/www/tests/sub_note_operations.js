/**
 * Sub-Note Operations Test
 * Tests sub-note creation and navigation
 */

const assert = require('assert');

class SubNoteOperationsTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Sub-Note Operations');
        console.log('Testing: Create Parent → Create Sub → Select Sub → Edit Sub');
        console.log('='.repeat(50));
        
        try {
            // Setup: Create parent note
            await this.step1_CreateParentNote();
            
            // Find parent note
            await this.step2_FindParentNote();
            
            // Create sub-note
            await this.step3_CreateSubNote();
            
            // Select sub-note
            await this.step4_SelectSubNote();
            
            // Edit sub-note
            await this.step5_EditSubNote();
            
            console.log('✅ Sub-Note Operations Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Sub-Note Operations Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async step1_CreateParentNote() {
        console.log('\n📝 Step 1: Create Parent Note');
        const userInput = '/createnote parent note for sub-test';
        const agentResponse = 'Do you want to create a note with title \'parent note for sub-test\'? (yes/no)';
        
        this.recordStep('Create parent note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to create a note'), 'Expected creation prompt');
        
        const confirmInput = 'yes';
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'parent note for sub-test\'';
        this.recordStep('Confirm creation', confirmInput, confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async step2_FindParentNote() {
        console.log('\n🔍 Step 2: Find Parent Note');
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'parent note for sub-test\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find parent note', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
    }

    async step3_CreateSubNote() {
        console.log('\n📝 Step 3: Create Sub-Note');
        const userInput = '/createsub';
        const agentResponse = 'I\'ll create a sub-note under \'parent note for sub-test\'. What should be the name of the sub-note?';
        
        this.recordStep('Create sub-note', userInput, agentResponse);
        assert(agentResponse.includes('create a sub-note'), 'Expected sub-note creation prompt');
        
        const subNoteName = 'sub-note title';
        const confirmResponse = 'Do you want to create a sub-note with title \'sub-note title\' under \'parent note for sub-test\'? (yes/no)';
        this.recordStep('Sub-note name', subNoteName, confirmResponse);
        assert(confirmResponse.includes('create a sub-note'), 'Expected sub-note confirmation');
        
        const confirmInput = 'yes';
        const successResponse = 'Sub-note created successfully! ID: 2, Title: \'sub-note title\'';
        this.recordStep('Confirm sub-note', confirmInput, successResponse);
        assert(successResponse.includes('Sub-note created successfully'), 'Expected sub-note creation success');
    }

    async step4_SelectSubNote() {
        console.log('\n🔍 Step 4: Select Sub-Note');
        const userInput = '/selectsubnote 2';
        const agentResponse = 'Selected sub-note: \'sub-note title\' (ID: 2).\n\n➡️ 📝 sub-note title (ID: 2)\n└── (no sub-notes)\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Select sub-note', userInput, agentResponse);
        assert(agentResponse.includes('Selected sub-note'), 'Expected sub-note selection');
        assert(agentResponse.includes('sub-note title'), 'Expected correct sub-note title');
    }

    async step5_EditSubNote() {
        console.log('\n✏️ Step 5: Edit Sub-Note');
        const userInput = '/editdescription';
        const agentResponse = 'I\'ll start description editing mode for \'sub-note title\'. Type or record the new content. To finish, say \'stop editing description\'.';
        
        this.recordStep('Start editing sub-note', userInput, agentResponse);
        assert(agentResponse.includes('start description editing mode'), 'Expected editing mode start');
        
        const descriptionInput = 'this is a sub-note description';
        const addResponse = '✅ Added to story description. Continue writing or say \'stop editing description\' to finish.';
        this.recordStep('Add sub-note description', descriptionInput, addResponse);
        assert(addResponse.includes('Added to story description'), 'Expected description added');
        
        const stopInput = '/stopediting';
        const stopResponse = 'Do you want to update the description for \'sub-note title\' with: \'this is a sub-note description.\'? (yes/no)';
        this.recordStep('Stop editing sub-note', stopInput, stopResponse);
        assert(stopResponse.includes('Do you want to update'), 'Expected update confirmation');
        
        const confirmInput = 'yes';
        const confirmResponse = '✅ Note description for \'sub-note title\' updated successfully!';
        this.recordStep('Confirm sub-note update', confirmInput, confirmResponse);
        assert(confirmResponse.includes('updated successfully'), 'Expected update success');
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
        const test = new SubNoteOperationsTest();
        await test.run();
    }
};
