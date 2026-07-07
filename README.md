# ops CLI

English: [README.en.md](README.en.md)

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

### 它會自動安裝前置工具嗎？

**不會默默自動安裝。**

`ops` 預設只會檢查環境，告訴你缺什麼。它會檢查：

```text
git
node
npm
spectra
gh
GSD
openspec/config.yaml
.planning/config.json
```

`ops doctor` 可以在只有 Spectra 可用時通過，代表「Spectra 自動化入口」可用。`ops setup` 會更嚴格列出完整模式缺口，例如 GSD CLI 或 `.planning/config.json`。

如果你明確執行：

```bash
ops setup --install-missing
```

它才會嘗試安裝可安全判斷的缺少工具。

注意：`ops` 目前**不會自動安裝 Spectra**，因為公開 registry 上有同名或近似名稱的非本工作流 CLI，亂裝會裝錯。Spectra 必須用你的官方或團隊指定來源安裝。

### 安裝 ops

從 GitHub 安裝：

```bash
npm install -g github:fishtvlvoe/ops-cli
```

或使用 installer script：

```bash
curl -fsSL https://raw.githubusercontent.com/fishtvlvoe/ops-cli/main/scripts/install.sh | bash
```

如果要明確嘗試安裝可支援的缺少工具：

```bash
curl -fsSL https://raw.githubusercontent.com/fishtvlvoe/ops-cli/main/scripts/install.sh | bash -s -- --install-missing
```

本機開發：

```bash
git clone https://github.com/fishtvlvoe/ops-cli.git
cd ops-cli
npm install
npm link
```

## 使用

現在第一段用法是「Spectra 自動化入口」：

```bash
ops doctor
ops status
ops "幫我做會員邀請功能"
ops debug "付款後沒有寄信"
ops finish --change member-invite
```

### 目前該怎麼用？

```text
想開新功能 SR
  → ops "幫我做會員邀請功能"

想開 debug SR
  → ops debug "付款後沒有寄信"

想看目前有哪些 SR
  → ops status

想收尾某個 SR
  → ops finish --change <change-name>

想檢查別人環境能不能跑
  → ops doctor
  → ops setup
```

### 現在還不能做什麼？

目前 `ops` 還沒有深度接上 GSD 的 phase / context / execute，所以它還不會完整自動：

```text
開 SR → 拆 phase → 派 agent 實作 → 跑完整驗證 → 封存
```

現在已完成的是：

```text
自然語言 → 建 Spectra SR → 看狀態 → 收尾 gate
```

下一段才會接：

```text
Spectra SR → 產 GSD context → GSD plan / execute / verify → 回填 Spectra
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
