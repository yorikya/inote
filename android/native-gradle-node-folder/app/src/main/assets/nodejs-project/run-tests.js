#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Running all tests...\n');

const tests = [
    { name: 'quick-test.js', file: 'test/quick-test.js', timeout: 60000 },
    { name: 'simple-test.js', file: 'test/simple-test.js', timeout: 120000 },
    { name: 'context-commands-test.js', file: 'test/context-commands-test.js', timeout: 60000 }
];

async function runTest(test) {
    return new Promise((resolve, reject) => {
        console.log(`📋 Running ${test.name}...`);
        
        const child = spawn('node', [test.file], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`${test.name} timed out after ${test.timeout/1000}s`));
        }, test.timeout);
        
        child.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                console.log(`✅ ${test.name} passed\n`);
                resolve();
            } else {
                reject(new Error(`${test.name} failed with exit code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`${test.name} failed: ${error.message}`));
        });
    });
}

async function runAllTests() {
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await runTest(test);
            passed++;
        } catch (error) {
            console.error(`❌ ${test.name} failed: ${error.message}\n`);
            failed++;
        }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Duration: ${duration}s`);
    
    if (failed > 0) {
        console.log('\n💥 Some tests failed!');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    }
}

runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
});
