#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const VERSION = '0.1.0';

const HELP = `ops ${VERSION}

用法:
  ops "幫我做會員邀請功能"        自然語言入口
  ops run "幫我修付款後沒寄信"     同上，明確使用 run
  ops feature "會員邀請功能"       建立功能型 Spectra SR
  ops debug "付款後沒寄信"         建立 debug 型 Spectra SR
  ops finish [change]              跑 Spectra 收尾檢查
  ops status [--change name]       看 Spectra / GSD 狀態
  ops doctor [--json]              檢查本機工具
  ops setup                        顯示缺少工具與安裝提示

常用選項:
  --json                           輸出 JSON
  --change <name>                  指定 Spectra change
  --archive                        finish 通過後執行 spectra archive
  --yes                            搭配 --archive 跳過 Spectra 確認
`;

function main(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  const parsed = parseArgs(argv);
  const command = parsed.command;

  try {
    if (!command || command === '--help' || command === '-h' || command === 'help') {
      print(HELP);
      return 0;
    }

    if (command === '--version' || command === '-v' || command === 'version') {
      print(VERSION);
      return 0;
    }

    if (command === 'doctor') return doctor({ cwd, json: parsed.flags.json });
    if (command === 'setup') return setup({ cwd, json: parsed.flags.json });
    if (command === 'status') return status({ cwd, json: parsed.flags.json, change: parsed.flags.change });
    if (command === 'finish') {
      return finish({
        cwd,
        json: parsed.flags.json,
        change: parsed.flags.change || parsed.positionals[0],
        archive: parsed.flags.archive,
        yes: parsed.flags.yes,
      });
    }

    if (command === 'feature' || command === 'debug') {
      const prompt = parsed.positionals.join(' ').trim();
      return createSpectraChange({
        cwd,
        kind: command,
        prompt,
        json: parsed.flags.json,
        change: parsed.flags.change,
      });
    }

    if (command === 'run') {
      const prompt = parsed.positionals.join(' ').trim();
      return runNaturalLanguage({ cwd, prompt, json: parsed.flags.json, change: parsed.flags.change });
    }

    const prompt = [command, ...parsed.positionals].join(' ').trim();
    return runNaturalLanguage({ cwd, prompt, json: parsed.flags.json, change: parsed.flags.change });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (parsed.flags.json) {
      print(JSON.stringify({ ok: false, error: message }, null, 2));
    } else {
      print(`錯誤: ${message}`, 'stderr');
    }
    return 1;
  }
}

function runNaturalLanguage({ cwd, prompt, json, change }) {
  if (!prompt) throw new Error('請提供需求文字，例如：ops "幫我做會員邀請功能"');
  const intent = classifyIntent(prompt);

  if (intent === 'setup') return setup({ cwd, json });
  if (intent === 'status') return status({ cwd, json, change });
  if (intent === 'finish') return finish({ cwd, json, change, archive: false, yes: false });
  if (intent === 'debug') return createSpectraChange({ cwd, kind: 'debug', prompt, json, change });
  return createSpectraChange({ cwd, kind: 'feature', prompt, json, change });
}

function doctor({ cwd, json }) {
  const project = inspectProject(cwd);
  const tools = [
    inspectTool('git', ['--version']),
    inspectTool('node', ['--version']),
    inspectTool('npm', ['--version']),
    inspectTool('spectra', ['--version']),
    inspectTool('gh', ['--version']),
  ];
  const gsd = inspectGsd(cwd);
  const result = {
    ok: tools.every((tool) => tool.found) && project.hasSpectra,
    cwd,
    project,
    tools,
    gsd,
  };

  if (json) {
    print(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  print('OPS 環境檢查');
  print(`專案路徑: ${cwd}`);
  print(`Spectra 專案: ${project.hasSpectra ? '有' : '沒有 openspec/config.yaml'}`);
  print(`GSD 專案: ${project.hasGsd ? '有 .planning/config.json' : '沒有 .planning/config.json'}`);
  for (const tool of tools) {
    print(`${tool.found ? 'OK' : 'MISS'} ${tool.name}${tool.version ? ` - ${tool.version}` : ''}`);
  }
  print(`${gsd.found ? 'OK' : 'MISS'} gsd${gsd.detail ? ` - ${gsd.detail}` : ''}`);

  if (!result.ok) {
    print('');
    print('下一步: 跑 ops setup 看安裝提示。');
  }

  return result.ok ? 0 : 1;
}

function setup({ cwd, json }) {
  const project = inspectProject(cwd);
  const missing = [];
  if (!inspectTool('git', ['--version']).found) missing.push({ item: 'git', hint: '安裝 Git。' });
  if (!inspectTool('node', ['--version']).found) missing.push({ item: 'node', hint: '安裝 Node.js 20 以上。' });
  if (!inspectTool('npm', ['--version']).found) missing.push({ item: 'npm', hint: '安裝 npm。' });
  if (!inspectTool('spectra', ['--version']).found) missing.push({ item: 'spectra', hint: '安裝 Spectra CLI。' });
  if (!project.hasSpectra) missing.push({ item: 'openspec', hint: '在專案根目錄執行 spectra init。' });
  if (!inspectGsd(cwd).found) {
    missing.push({ item: 'gsd', hint: '安裝 GSD Core，或先只使用 Spectra 模式。' });
  }

  const result = { ok: missing.length === 0, cwd, missing };
  if (json) {
    print(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (missing.length === 0) {
    print('環境看起來可以跑完整流程。');
    return 0;
  }

  print('目前還缺這些東西:');
  for (const item of missing) print(`- ${item.item}: ${item.hint}`);
  return 1;
}

function status({ cwd, json, change }) {
  ensureSpectra();
  const project = inspectProject(cwd);
  const list = runJson('spectra', ['list', '--json'], cwd);
  const selectedChange = change || inferSingleChange(list.changes || []);
  const detail = selectedChange
    ? safeJsonCommand('spectra', ['status', '--change', selectedChange, '--json'], cwd)
    : null;
  const result = {
    ok: true,
    cwd,
    project,
    changes: list.changes || [],
    selectedChange,
    detail,
  };

  if (json) {
    print(JSON.stringify(result, null, 2));
    return 0;
  }

  print('OPS 狀態');
  print(`Spectra changes: ${result.changes.length}`);
  for (const item of result.changes) {
    print(`- ${item.name}: ${item.status} (${item.completedTasks}/${item.totalTasks})`);
  }
  if (detail) print(`目前 change: ${selectedChange} / complete=${detail.isComplete ? 'yes' : 'no'}`);
  if (project.hasGsd) print('GSD: 找到 .planning/config.json');
  return 0;
}

function finish({ cwd, json, change, archive, yes }) {
  ensureSpectra();
  const selectedChange = change || inferChangeFromSpectra(cwd);
  if (!selectedChange) throw new Error('找不到唯一的 Spectra change，請加 --change <name>。');

  const statusResult = runJson('spectra', ['status', '--change', selectedChange, '--json'], cwd);
  const analyze = runJson('spectra', ['analyze', selectedChange, '--json'], cwd);
  const validate = runJson('spectra', ['validate', selectedChange, '--json'], cwd);
  const unchecked = readUncheckedTasks(cwd, selectedChange);
  const analyzeClean = (analyze.dimensions || []).every((dimension) => dimension.finding_count === 0);
  const validateClean = Array.isArray(validate)
    ? validate.every((entry) => entry.valid)
    : Boolean(validate.valid);
  const ok = Boolean(statusResult.isComplete) && analyzeClean && validateClean && unchecked.length === 0;

  let archiveResult = null;
  if (ok && archive) {
    const args = ['archive', selectedChange];
    if (yes) args.push('--yes');
    const archived = runText('spectra', args, cwd);
    archiveResult = { ok: archived.status === 0, stdout: archived.stdout, stderr: archived.stderr };
  }

  const result = {
    ok,
    change: selectedChange,
    status: statusResult,
    analyze,
    validate,
    unchecked,
    archive: archiveResult,
  };

  if (json) {
    print(JSON.stringify(result, null, 2));
    return ok ? 0 : 1;
  }

  print(`收尾檢查: ${selectedChange}`);
  print(`tasks 完成: ${statusResult.isComplete ? '是' : '否'}`);
  print(`analyze: ${analyzeClean ? '乾淨' : '有問題'}`);
  print(`validate: ${validateClean ? '通過' : '失敗'}`);
  print(`未勾 tasks: ${unchecked.length}`);
  if (archiveResult) print(`archive: ${archiveResult.ok ? '完成' : '失敗'}`);
  if (!ok) print('結果: 尚未達到 Spectra 收尾標準。');
  return ok ? 0 : 1;
}

function createSpectraChange({ cwd, kind, prompt, json, change }) {
  ensureSpectra();
  if (!prompt) throw new Error(`請提供${kind === 'debug' ? 'debug 問題' : '功能需求'}文字。`);

  const name = change || makeChangeName(kind, prompt);
  const description = prompt.trim();
  runRequired('spectra', ['new', 'change', name, '--schema', 'spec-driven', '--agent', 'ops', '--description', description], cwd);
  writeArtifact(cwd, name, 'proposal', proposalTemplate({ name, kind, description }));
  writeArtifact(cwd, name, 'design', designTemplate({ name, kind, description }));
  writeArtifact(cwd, name, 'tasks', tasksTemplate({ kind }));
  writeArtifact(cwd, name, 'spec', specTemplate({ kind, description }), name);

  const detail = safeJsonCommand('spectra', ['status', '--change', name, '--json'], cwd);
  const result = { ok: true, intent: kind, change: name, description, detail };

  if (json) {
    print(JSON.stringify(result, null, 2));
    return 0;
  }

  print(`${kind === 'debug' ? '已建立 debug SR' : '已建立功能 SR'}: ${name}`);
  print(`位置: openspec/changes/${name}`);
  print('下一步: 補齊具體需求後交給 GSD 拆工，完成後跑 ops finish。');
  return 0;
}

function writeArtifact(cwd, change, type, content, capability) {
  const args = ['new', 'artifact', type];
  if (capability) args.push(capability);
  args.push('--change', change, '--stdin', '--force');
  runRequired('spectra', args, cwd, content);
}

function proposalTemplate({ name, kind, description }) {
  return `# ${name}

## Why

${kind === 'debug'
  ? `目前需要修復或釐清：${description}`
  : `目前需要交付新功能：${description}`}

## What Changes

- 建立可驗證的交付範圍。
- 實作前先確認需求、限制與驗證方式。
- 完成後必須提供測試或行為證據。

## Impact

- Affected users: 待補。
- Affected systems: 待補。
- Validation gate: tests / build / runtime evidence / Spectra analyze / Spectra validate。

## Non-Goals

- 不在沒有證據時勾選 tasks。
- 不跳過 Spectra analyze / validate。
`;
}

function designTemplate({ kind, description }) {
  return `# Design

## Context

此 change 由 ops CLI 建立，用來把自然語言需求轉成可驗收的 Spectra SR。

## Decision: Keep Spectra as the completion contract

本 change 的完成狀態以 Spectra artifacts 和 tasks.md 為準。GSD 或其他 agent 可以協助拆工與執行，但不能取代 Spectra 收尾驗證。

## Approach

- 先確認專案 root、受影響範圍與驗證命令。
- 再補測試或重現步驟。
- 最後進行實作、驗證、Spectra 收尾。

## Execution Notes

- 任務描述：${description}
- 類型：${kind}
- 實作前需要確認專案 root、測試命令、部署或資料安全邊界。
- 若涉及 UI，需補充截圖或瀏覽器 smoke evidence。
`;
}

function tasksTemplate({ kind }) {
  const requirement = kind === 'debug' ? 'Debug outcome is verified' : 'Feature outcome is verified';
  return `## 1. Scope

- [ ] 1.1 對齊 Requirement: ${requirement}，確認此 ${kind === 'debug' ? 'debug' : '功能'} 的專案 root、受影響檔案、驗證命令與完成標準。
- [ ] 1.2 補齊 proposal、design、spec 的具體需求與非目標。

## 2. Execution

- [ ] 2.1 先補測試或可重現驗證，證明 Requirement: ${requirement} 尚未滿足或已有明確驗證路徑，再進行實作。
- [ ] 2.2 執行實作並保留關鍵 evidence。

## 3. Closeout

- [ ] 3.1 跑 focused tests / type-check / build 或等價驗證。
- [ ] 3.2 跑 spectra analyze 與 spectra validate，確認 Requirement: ${requirement} 已被 tasks 覆蓋，通過後才回報完成。
`;
}

function specTemplate({ kind, description }) {
  const requirement = kind === 'debug' ? 'Debug outcome is verified' : 'Feature outcome is verified';
  return `## ADDED Requirements

### Requirement: ${requirement}
The system SHALL deliver the requested outcome with explicit verification evidence.

#### Scenario: Complete requested work
- **GIVEN** the requested work is "${description}"
- **WHEN** implementation is complete
- **THEN** the operator SHALL be able to verify the outcome using documented tests, checks, or runtime evidence

##### Example: Evidence-backed closeout

- **GIVEN** an agent reports the work as complete
- **WHEN** Spectra closeout runs
- **THEN** spectra analyze and spectra validate SHALL pass before the change is archived
`;
}

function inspectProject(cwd) {
  return {
    root: cwd,
    hasGit: existsSync(join(cwd, '.git')),
    hasSpectra: existsSync(join(cwd, 'openspec', 'config.yaml')),
    hasGsd: existsSync(join(cwd, '.planning', 'config.json')),
    hasPackageJson: existsSync(join(cwd, 'package.json')),
    hasAgents: existsSync(join(cwd, 'AGENTS.md')),
  };
}

function inspectTool(name, versionArgs) {
  const found = commandExists(name);
  if (!found) return { name, found: false };
  const result = spawnSync(name, versionArgs, { encoding: 'utf8' });
  return {
    name,
    found: true,
    version: firstLine(result.stdout || result.stderr),
  };
}

function inspectGsd(cwd) {
  const local = join(cwd, 'gsd-core', 'bin', 'gsd-tools.cjs');
  const localCodex = join(cwd, '.codex', 'gsd-core', 'bin', 'gsd-tools.cjs');
  const localClaude = join(cwd, '.claude', 'gsd-core', 'bin', 'gsd-tools.cjs');
  if (existsSync(local)) return { found: true, detail: local };
  if (existsSync(localCodex)) return { found: true, detail: localCodex };
  if (existsSync(localClaude)) return { found: true, detail: localClaude };
  if (commandExists('gsd-tools')) return { found: true, detail: 'gsd-tools on PATH' };
  if (commandExists('gsd-core')) return { found: true, detail: 'gsd-core on PATH' };
  return { found: false, detail: null };
}

function classifyIntent(text) {
  const normalized = text.toLowerCase();
  if (/(setup|安裝|環境|檢查工具)/i.test(normalized)) return 'setup';
  if (/(finish|archive|收尾|封存|完成檢查)/i.test(normalized)) return 'finish';
  if (/(status|進度|狀態|目前)/i.test(normalized)) return 'status';
  if (/(debug|bug|錯誤|修|壞|失敗|不能|沒寄|沒看到)/i.test(normalized)) return 'debug';
  return 'feature';
}

function makeChangeName(kind, prompt) {
  const slug = slugify(prompt);
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
  const prefix = kind === 'debug' ? 'debug' : 'feature';
  return slug ? `${prefix}-${slug}`.slice(0, 70).replace(/-+$/g, '') : `${prefix}-${timestamp}`;
}

function slugify(text) {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

function inferChangeFromSpectra(cwd) {
  const list = runJson('spectra', ['list', '--json'], cwd);
  return inferSingleChange(list.changes || []);
}

function inferSingleChange(changes) {
  if (changes.length === 1) return changes[0].name;
  const active = changes.filter((change) => change.status !== 'done');
  if (active.length === 1) return active[0].name;
  return null;
}

function readUncheckedTasks(cwd, change) {
  const path = join(cwd, 'openspec', 'changes', change, 'tasks.md');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((entry) => /- \[ \]/.test(entry.text));
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  let command = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!command && ['--help', '-h', '--version', '-v'].includes(arg)) {
      command = arg;
      continue;
    }
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
    if (arg === '--json') {
      flags.json = true;
      continue;
    }
    if (arg === '--archive') {
      flags.archive = true;
      continue;
    }
    if (arg === '--yes' || arg === '-y') {
      flags.yes = true;
      continue;
    }
    if (arg === '--change') {
      flags.change = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--change=')) {
      flags.change = arg.slice('--change='.length);
      continue;
    }
    positionals.push(arg);
  }

  return { command, flags, positionals };
}

function ensureSpectra() {
  if (!commandExists('spectra')) throw new Error('找不到 spectra CLI。請先安裝 Spectra。');
}

function commandExists(name) {
  const result = spawnSync('sh', ['-lc', `command -v ${shellQuote(name)}`], { encoding: 'utf8' });
  return result.status === 0;
}

function runJson(command, args, cwd) {
  const result = runText(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')} did not return JSON`);
  }
}

function safeJsonCommand(command, args, cwd) {
  try {
    return runJson(command, args, cwd);
  } catch {
    return null;
  }
}

function runRequired(command, args, cwd, input) {
  const result = runText(command, args, cwd, input);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function runText(command, args, cwd, input) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function firstLine(text) {
  return String(text || '').trim().split(/\r?\n/)[0] || '';
}

function print(message = '', stream = 'stdout') {
  const target = stream === 'stderr' ? process.stderr : process.stdout;
  target.write(`${message}\n`);
}

if (isCliEntrypoint()) {
  process.exitCode = main();
}

export {
  classifyIntent,
  inspectProject,
  makeChangeName,
  parseArgs,
  slugify,
};

function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
