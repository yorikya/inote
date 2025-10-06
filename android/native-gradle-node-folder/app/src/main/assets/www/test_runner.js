#!/usr/bin/env node

/**
 * Simple E2E Test Runner
 * Usage: node test_runner.js <test_file>
 * Example: node test_runner.js tests/note_taking_flow.js
 */

const fs = require('fs');
const path = require('path');

class SimpleTestRunner {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    async runTest(testFile) {
        console.log(`🧪 Running test: ${testFile}`);
        console.log('='.repeat(50));
        
        try {
            // Check if test file exists
            if (!fs.existsSync(testFile)) {
                throw new Error(`Test file not found: ${testFile}`);
            }

            // Load and run the test
            const testModule = require(path.resolve(testFile));
            
            if (typeof testModule.run === 'function') {
                await testModule.run();
                this.recordResult(testFile, true, 'Test passed');
            } else {
                throw new Error('Test file must export a "run" function');
            }
            
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            this.recordResult(testFile, false, error.message);
        }
    }

    async runAllTests() {
        console.log('🚀 Running All Tests');
        console.log('='.repeat(50));
        
        const testsDir = path.join(__dirname, 'tests');
        
        if (!fs.existsSync(testsDir)) {
            console.log('❌ Tests directory not found');
            return;
        }
        
        const testFiles = fs.readdirSync(testsDir)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(testsDir, file));
        
        if (testFiles.length === 0) {
            console.log('❌ No test files found in tests/ directory');
            return;
        }
        
        for (const testFile of testFiles) {
            await this.runTest(testFile);
        }
    }

    recordResult(testFile, passed, message) {
        this.testResults.push({
            test: testFile,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    printSummary() {
        const endTime = Date.now();
        const duration = (endTime - this.startTime) / 1000;
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Success Rate: ${successRate}%`);
        console.log(`Duration: ${duration.toFixed(2)} seconds`);
        
        if (failedTests > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`- ${r.test}: ${r.message}`));
        }
        
        if (successRate === 100) {
            console.log('\n🎉 ALL TESTS PASSED! 🎉');
        } else if (successRate >= 80) {
            console.log('\n✅ Most tests passed! Minor issues to fix.');
        } else {
            console.log('\n⚠️ Several tests failed. Review the issues above.');
        }
        
        console.log('='.repeat(50));
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node test_runner.js [test_file]');
        console.log('Examples:');
        console.log('  node test_runner.js tests/note_taking_flow.js');
        console.log('  node test_runner.js all');
        process.exit(1);
    }
    
    const testFile = args[0];
    const runner = new SimpleTestRunner();
    
    try {
        if (testFile === 'all') {
            await runner.runAllTests();
        } else {
            await runner.runTest(testFile);
        }
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        process.exit(1);
    } finally {
        runner.printSummary();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SimpleTestRunner;
