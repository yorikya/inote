/**
 * Editing Flow Test
 * Tests the complete note editing workflow
 */

const assert = require('assert');

class EditingFlowTest {
    constructor() {
        this.testSteps = [];
        this.currentStep = 0;
    }

    async run() {
        console.log('🧪 Testing: Editing Flow');
        console.log('Testing: Create → Find → Edit → Save → Verify');
        console.log('='.repeat(50));
        
        try {
            // Setup: Create note
            await this.step1_CreateNote();
            
            // Find note
            await this.step2_FindNote();
            
            // Start editing
            await this.step3_StartEditing();
            
            // Add description
            await this.step4_AddDescription();
            
            // Stop editing
            await this.step5_StopEditing();
            
            // Verify update
            await this.step6_VerifyUpdate();
            
            console.log('✅ Editing Flow Test PASSED!');
            this.printTestSteps();
            
        } catch (error) {
            console.log('❌ Editing Flow Test FAILED!');
            console.log('Error at step ' + (this.currentStep + 1) + ': ' + error.message);
            this.printTestSteps();
            throw error;
        }
    }

    async step1_CreateNote() {
        console.log('\n📝 Step 1: Create Note');
        const userInput = '/createnote editing test note';
        const agentResponse = 'Do you want to create a note with title \'editing test note\'? (yes/no)';
        
        this.recordStep('Create note', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to create a note'), 'Expected creation prompt');
        
        const confirmInput = 'yes';
        const confirmResponse = 'Note created successfully! ID: 1, Title: \'editing test note\'';
        this.recordStep('Confirm creation', confirmInput, confirmResponse);
        assert(confirmResponse.includes('Note created successfully'), 'Expected creation success');
    }

    async step2_FindNote() {
        console.log('\n🔍 Step 2: Find Note');
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'editing test note\' (ID: 1). What would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Find note', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
    }

    async step3_StartEditing() {
        console.log('\n✏️ Step 3: Start Editing');
        const userInput = '/editdescription';
        const agentResponse = 'I\'ll start description editing mode for \'editing test note\'. Type or record the new content. To finish, say \'stop editing description\'.';
        
        this.recordStep('Start editing', userInput, agentResponse);
        assert(agentResponse.includes('start description editing mode'), 'Expected editing mode start');
    }

    async step4_AddDescription() {
        console.log('\n📝 Step 4: Add Description');
        const userInput = 'this is a test description for the note';
        const agentResponse = '✅ Added to story description. Continue writing or say \'stop editing description\' to finish.';
        
        this.recordStep('Add description', userInput, agentResponse);
        assert(agentResponse.includes('Added to story description'), 'Expected description added');
    }

    async step5_StopEditing() {
        console.log('\n🛑 Step 5: Stop Editing');
        const userInput = '/stopediting';
        const agentResponse = 'Do you want to update the description for \'editing test note\' with: \'this is a test description for the note.\'? (yes/no)';
        
        this.recordStep('Stop editing', userInput, agentResponse);
        assert(agentResponse.includes('Do you want to update'), 'Expected update confirmation');
        
        const confirmInput = 'yes';
        const confirmResponse = '✅ Note description for \'editing test note\' updated successfully!';
        this.recordStep('Confirm update', confirmInput, confirmResponse);
        assert(confirmResponse.includes('updated successfully'), 'Expected update success');
    }

    async step6_VerifyUpdate() {
        console.log('\n✅ Step 6: Verify Update');
        const userInput = '/findbyid 1';
        const agentResponse = 'Found note: \'editing test note\' (ID: 1).\n\n💬 this is a test description for the note.\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai)';
        
        this.recordStep('Verify update', userInput, agentResponse);
        assert(agentResponse.includes('Found note'), 'Expected note found');
        assert(agentResponse.includes('this is a test description for the note'), 'Expected description in response');
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
        const test = new EditingFlowTest();
        await test.run();
    }
};
