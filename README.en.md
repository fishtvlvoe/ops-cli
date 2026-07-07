# ops CLI

`ops` is a thin local workflow entry point for connecting Spectra and GSD.

It does not replace Spectra or GSD.

```text
You describe the work
  ↓
ops routes it as feature / debug / finish / status
  ↓
Spectra owns the SR, specs, tasks, and acceptance gate
  ↓
GSD can own planning, dispatch, execution, and verification
  ↓
ops runs closeout gates so unfinished work is not reported as done
```

## Does ops auto-install prerequisites?

No, not silently.

By default, `ops` checks your environment and tells you what is missing. It does not automatically install `git`, `node`, `npm`, `spectra`, `gh`, or GSD behind your back.

`ops doctor` can pass when Spectra is available even if GSD project config is missing. That means the Spectra automation entry point is ready. `ops setup` is stricter and lists full-mode gaps such as GSD CLI or `.planning/config.json`.

There is one explicit path for supported installs:

```bash
ops setup --install-missing
```

Even then, Spectra is not auto-installed by ops because public package registries contain similarly named packages that are not necessarily the Spectra CLI used by this workflow. Install Spectra from your official/team-approved source, then run `ops doctor`.

## Install ops

Install from GitHub:

```bash
npm install -g github:fishtvlvoe/ops-cli
```

Or use the installer script:

```bash
curl -fsSL https://raw.githubusercontent.com/fishtvlvoe/ops-cli/main/scripts/install.sh | bash
```

Explicitly attempt supported missing installs:

```bash
curl -fsSL https://raw.githubusercontent.com/fishtvlvoe/ops-cli/main/scripts/install.sh | bash -s -- --install-missing
```

## Commands

```bash
ops "build member invitations"
ops debug "payment succeeded but email was not sent"
ops status
ops finish --change member-invite
ops doctor
ops setup
```

## What v0.1 does

- `ops doctor`: checks `git`, `node`, `npm`, `spectra`, `gh`, and GSD signals.
- `ops setup`: lists missing tools and next actions.
- `ops status`: reads Spectra change status and detects GSD `.planning/config.json`.
- `ops feature "..."`: creates a feature-oriented Spectra change skeleton.
- `ops debug "..."`: creates a debug-oriented Spectra change skeleton.
- `ops finish`: runs `spectra status`, `spectra analyze`, `spectra validate`, and checks unchecked `tasks.md` items.

## Required tools

Minimum mode:

```text
ops CLI
Spectra
```

Full mode:

```text
AI CLI      Codex / Claude / Cursor / another agent entry point
ops CLI     this tool
Spectra     SR / spec / tasks / analyze / validate
GSD         planning / dispatch / phase verification
Project     git / pnpm / npm / pytest / composer / etc.
```

## Development

```bash
npm test
npm run check
```

## License

MIT
