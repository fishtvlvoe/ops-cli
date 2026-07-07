import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyIntent, makeChangeName, parseArgs, slugify } from '../bin/ops.mjs';

test('classifyIntent routes common Chinese requests', () => {
  assert.equal(classifyIntent('幫我做會員邀請功能'), 'feature');
  assert.equal(classifyIntent('付款後沒有寄信，幫我修'), 'debug');
  assert.equal(classifyIntent('收尾目前 SR'), 'finish');
  assert.equal(classifyIntent('看目前進度'), 'status');
  assert.equal(classifyIntent('檢查環境'), 'setup');
});

test('slugify keeps safe ASCII names', () => {
  assert.equal(slugify('Member Invite Feature!!'), 'member-invite-feature');
  assert.equal(slugify('會員邀請功能'), '');
});

test('makeChangeName uses stable prefixes', () => {
  assert.match(makeChangeName('feature', 'Member Invite Feature'), /^feature-member-invite-feature$/);
  assert.match(makeChangeName('debug', '付款後沒有寄信'), /^debug-\d{12}$/);
});

test('parseArgs supports command flags and positionals', () => {
  const parsed = parseArgs(['finish', '--change', 'abc', '--archive', '--yes']);
  assert.equal(parsed.command, 'finish');
  assert.equal(parsed.flags.change, 'abc');
  assert.equal(parsed.flags.archive, true);
  assert.equal(parsed.flags.yes, true);
});

test('parseArgs keeps leading meta flags as commands', () => {
  assert.equal(parseArgs(['--version']).command, '--version');
  assert.equal(parseArgs(['--help']).command, '--help');
});
