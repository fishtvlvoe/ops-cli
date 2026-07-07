# ops 流程圖

```text
你
│
│  「幫我做會員邀請功能」
▼
┌──────────────┐
│   ops CLI    │
└──────┬───────┘
       │
       ├─ feature/debug → 建立 Spectra SR
       │
       ├─ status        → 讀 Spectra / GSD 狀態
       │
       ├─ finish        → 跑 Spectra 收尾 gate
       │
       └─ setup         → 檢查工具是否齊全
```

## 未來串 GSD 的方向

第一版先把 Spectra 層做穩。後續再加：

```text
Spectra change
  ↓
ops 產 GSD context
  ↓
GSD plan / execute / verify
  ↓
ops 收集 evidence
  ↓
Spectra analyze / validate / archive
```

GSD 只做執行編排，不當完成狀態 SSOT。
