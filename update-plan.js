const fs = require('fs');
let text = fs.readFileSync('/Users/yonah/.claude/plans/docs-plan-md-gentle-squid.md', 'utf-8');
text = text.replace('## Phase 5: 接入 App.tsx / Sidebar / Header', '## [x] Phase 5: 接入 App.tsx / Sidebar / Header');
text = text.replace('### 5.1 修改 `App.tsx`', '### [x] 5.1 修改 `App.tsx`');
text = text.replace('### 5.2 修改 `Sidebar.tsx`', '### [x] 5.2 修改 `Sidebar.tsx`');
text = text.replace('### 5.3 Header.tsx — **无需修改**', '### [x] 5.3 Header.tsx — **无需修改**');
fs.writeFileSync('/Users/yonah/.claude/plans/docs-plan-md-gentle-squid.md', text);
