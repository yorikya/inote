const test = require('node:test');
const assert = require('node:assert');
const CommandRouter = require('../../CommandRouter');

test('CommandRouter.parseSlashCommand', (t) => {
    // Test parsing a simple command
    const result1 = CommandRouter.parseSlashCommand('/createnote Test Note');
    assert.strictEqual(result1.cmd, '/createnote');
    assert.deepStrictEqual(result1.args, ['Test', 'Note']);

    // Test parsing a command with no args
    const result2 = CommandRouter.parseSlashCommand('/showparents');
    assert.strictEqual(result2.cmd, '/showparents');
    assert.deepStrictEqual(result2.args, []);

    // Test parsing non-command
    const result3 = CommandRouter.parseSlashCommand('This is not a command');
    assert.strictEqual(result3, null);

    // Test parsing empty string
    const result4 = CommandRouter.parseSlashCommand('');
    assert.strictEqual(result4, null);

    // Test parsing command with special characters
    const result5 = CommandRouter.parseSlashCommand('/createnote Note with "quotes" and & symbols');
    assert.strictEqual(result5.cmd, '/createnote');
    assert.deepStrictEqual(result5.args, ['Note', 'with', '"quotes"', 'and', '&', 'symbols']);
});

test('CommandRouter.getAvailableCommands', (t) => {
    const commands = CommandRouter.getAvailableCommands();

    // Check that it returns an array
    assert.ok(Array.isArray(commands));

    // Check that it includes known commands
    assert.ok(commands.some(cmd => cmd.command === '/createnote'));
    assert.ok(commands.some(cmd => cmd.command === '/findnote'));
    assert.ok(commands.some(cmd => cmd.command === '/edit'));
    assert.ok(commands.some(cmd => cmd.command === '/delete'));
    assert.ok(commands.some(cmd => cmd.command === '/markdone'));

    // Check that each command has the required properties
    commands.forEach(cmd => {
        assert.ok(cmd.command);
        assert.ok(typeof cmd.description === 'string');
    });
});
