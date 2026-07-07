# ops CLI

`ops` 是一個很薄的本機流程入口，用自然語言把 Spectra 和 GSD 串起來。

它不是取代 Spectra，也不是取代 GSD。

```text
你說需求
  ↓
ops 判斷是新功能 / debug / 收尾 / 狀態
  ↓
Spectra 管 SR、規格、tasks、驗收
  ↓
GSD 管拆工、派工、驗證流程
  ↓
ops 跑收尾 gate，避免沒有證據就宣稱完成
```

## 安裝

從 GitHub 安裝：

```bash
npm install -g github:fishtvlvoe/ops-cli
```

本機開發：

```bash
git clone https://github.com/fishtvlvoe/ops-cli.git
cd ops-cli
npm install
npm link
```

## 使用

在 Codex / Claude 裡，理想情況是 agent 背後幫你跑 `ops`。你自己也可以直接用：

```bash
ops "幫我做會員邀請功能"
ops debug "付款後沒有寄信"
ops status
ops finish --change member-invite
ops doctor
ops setup
```

## 目前第一版能做什麼

- `ops doctor`：檢查 `git`、`node`、`npm`、`spectra`、`gh`、GSD 線索。
- `ops setup`：列出缺什麼工具與下一步。
- `ops status`：讀 Spectra change 狀態，並檢查是否有 GSD `.planning/config.json`。
- `ops feature "..."`：建立功能型 Spectra change，補上 proposal / design / tasks / spec 初稿。
- `ops debug "..."`：建立 debug 型 Spectra change，補上基本驗收骨架。
- `ops finish`：跑 `spectra status`、`spectra analyze`、`spectra validate`，並檢查 `tasks.md` 是否還有未勾項目。

## 需要哪些底層工具

完整模式需要：

```text
AI CLI      Codex / Claude / Cursor 等任一入口
ops CLI     本工具
Spectra     SR / spec / tasks / analyze / validate
GSD         拆工 / 派工 / phase 驗證
專案工具    git / pnpm / npm / pytest / composer 等
```

最小模式只需要 `ops + Spectra`，可以先負責開 SR 與收尾檢查。

## 設計原則

- Spectra 的 `tasks.md` 是 SR 完成狀態 SSOT。
- GSD 可以協助拆工與執行，但不能取代 Spectra 驗收。
- `ops finish` 不會在 `analyze` / `validate` 或未勾 task 失敗時封存。
- 第一版先做 CLI，不先做外掛，避免污染全域 agent 設定。

## 開發

```bash
npm test
npm run check
```

## License

MIT
