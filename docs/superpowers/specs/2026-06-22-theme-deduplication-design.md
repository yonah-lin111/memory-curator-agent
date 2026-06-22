# Theme Deduplication & Auto-Cleanup Specification (主题去重与自清理设计规格书)

## 1. 背景与问题定义 (Background & Problem)

在 Memory Curator Agent 项目中，每周总结面板（`WeeklySummaryPanel`）提供了周总结及人际策展的重新生成（Regenerate）功能。然而，当前的自动主题提取逻辑在总结重新生成时存在以下两个突出问题：

1. **重复关联无法释放**：每次点击重新生成，系统都会调用 AI 提取当前总结所蕴含的成长主题。由于之前生成的旧主题关联（`theme_items`）没有被解绑，导致同一周总结被重复关联到越来越多、甚至互相冲突的主题上。
2. **同类主题库过度膨胀**：由于 LLM 的生成具有一定的随机性，且现有匹配算法仅依赖简单的字面双向包含模糊匹配（`t.name.includes(...)`），当 AI 提取出语义极度相似但词面稍微不同的主题（如「技能提升」和「技能增长」）时，系统无法合并，而是会创建大量同质的冗余主题，导致全局主题数据库过度臃肿。

为了保持主题库的精炼、精准与高可用性，本方案设计了一套 **“AI 候选池主动对齐 + 数据库级关系清理与孤立主题自蒸发”** 的去重方案。

---

## 2. 核心架构设计 (Core Architecture Design)

本去重方案采用 **双端结合（LLM 提示词语义对齐 + SQLite 数据库引擎清理）** 的闭环架构设计，实现零用户干扰、完全后台无感的高效去重。

### 2.1 双端闭环模型

```
[周度总结重新生成] 
       │
       ▼
1. 清理该周总结现有的旧 AI 主题关联 (theme_items 表中 ai_extracted = 1)
       │
       ▼
2. 拉取全量活跃主题列表 ──► 注入 AI 候选池
                               │
                               ▼
                        3. AI 提示词语义对齐 ──► 优先匹配已有主题，无法匹配才推荐新词
                               │
                               ▼
                        4. 写入新关联与新主题 (创建时标记 ai_generated = 1)
                               │
                               ▼
                        5. 触发孤立主题自蒸发 (清理 ai_generated = 1 且 itemCount = 0 的主题)
```

---

## 3. 详细设计与实现细节 (Detailed Design)

### 3.1 数据库结构变更 (Database Schema & Migration)

#### 1) 字段变更
在 `themes` 表中增加 `ai_generated` 字段，以区分主题是由 AI 自动建议生成的，还是由用户手动创建/从片段标签导入的。

* **`ai_generated`**: `INTEGER NOT NULL DEFAULT 0`
  * `1` (或 `true`): 表示此主题是由 AI 自动提取、在总结生成过程中创建的。
  * `0` (或 `false`): 表示此主题是用户手动创建、编辑，或是由片段标签（Tags）批量导入产生的。此类型的主题即便没有任何关联素材，也**绝对不会**被自动清理，以保护用户资产。

#### 2) SQLite 数据库迁移逻辑 (`src/main/db/index.ts`)
* **`createThemesTable`**：更新建表语句，补加 `ai_generated` 字段定义。
* **`migrateLegacySchema`**：检查已有数据库，若 `themes` 表存在且不含 `ai_generated` 列，则执行 `ALTER TABLE themes ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;`。

#### 3) TypeScript 类型对齐 (`src/main/db/schema.ts`)
* 更新 `ThemeRow`、`ThemeItem` 和 `ThemeCreateInput` 声明，补齐可选/必选的 `ai_generated` / `aiGenerated` 字段。

---

### 3.2 业务服务层修改 (Themes Service)

#### 1) 支持 `aiGenerated` 创建参数 (`themesService.ts`)
* `themesService.create` 在向 `themes` 表执行 `INSERT` 时，支持传入 `aiGenerated` 属性，写入 `ai_generated` 列（默认写入 `0`）。

#### 2) 引入孤立主题静默清理方法 (`themesService.ts`)
在 `themesService` 中增加一个独立的底层方法 `cleanupOrphanedAiThemes`，用于执行孤立 AI 主题的自蒸发：
```typescript
cleanupOrphanedAiThemes: () => {
  database.prepare(`
    DELETE FROM themes
    WHERE ai_generated = 1
      AND NOT EXISTS (
        SELECT 1 FROM theme_items WHERE theme_external_id = themes.external_id
      )
  `).run()
}
```

---

### 3.3 AI 提取流程与 IPC 处理器优化 (`src/main/ipc/weeklyHandlers.ts`)

#### 1) AI Prompt 主动对齐 (Candidate Candidates Injection)
在 `weeklySummary:generate` 或 `weeklyCurator:generate` 提取主题时：
1. 调用 `themesService.list('active')` 获取系统中所有已有的活跃主题。
2. 将这些主题的名称注入到 `extractThemesWithAI` 的系统提示词中作为**候选池**。
3. 改进 System Prompt 约束限制：
   * 必须优先在已有的主题名称中进行语义归入和对齐，强行抑制“技能积累”、“代码学习”这类同义不同词的随机膨胀。
   * 只有在完全无法匹配的情况下，才允许返回新主题。

#### 2) 保存提取主题时的全自清洗逻辑 (`saveExtractedThemes`)
在把新提取的主题写入数据库前，执行以下步骤：
1. **解绑本总结历史关联**：
   ```sql
   DELETE FROM theme_items 
   WHERE source_type = 'weekly_summary' 
     AND source_id = ? 
     AND ai_extracted = 1
   ```
2. **主题按需写入**：
   * 如果 AI 匹配或返回了已有主题，则直接关联。
   * 如果 AI 返回了新主题且在本地找不到包含关系，则创建全新主题，此时传入 `aiGenerated: 1` 标识该主题由 AI 产生。
3. **静默自清理**：
   * 调用 `themesService.cleanupOrphanedAiThemes()` 清理因本次重新生成（解绑了旧关联）或总结被修改、删除而导致不再有任何关联对象的 AI 主题，彻底防止脏数据堆积。

---

## 4. 健壮性与边缘情况处理 (Robustness & Edge Cases)

| 边缘情况 (Edge Case) | 预期行为 (Expected Behavior) | 处理机制 (Mechanism) |
| :--- | :--- | :--- |
| **重置周总结为“非 meaningful”/完全空总结** | 原总结关联的所有 AI 主题全部解绑，对应的 AI 主题自蒸发。 | 生成把关失败或重新生成为空内容时，仍会触发解绑与 `cleanupOrphanedAiThemes()`。 |
| **用户编辑了 AI 创建的主题描述/颜色** | 该主题依然保持 `ai_generated = 1` 状态。如果用户解绑了其所有的关联，此主题依然属于 AI 生成的主题，应当被自动清理。 | 保留原逻辑，防止闲置脏主题存留。若用户希望永久保留，只需在该主题下手动关联任何一个笔记、片段，由于存在手动关联记录，其便不满足 `NOT EXISTS` 清理条件，从而得以永久留存。 |
| **主题被手动导入过（从片段 Tags）** | 从 Tags 批量导入创建的主题默认 `ai_generated = 0`，属于资产库主题。 | 哪怕没有关联项，也会在主题列表中显示，不受自动清理影响。 |
| **重新生成时 LLM 临时离线或提取报错** | 重新生成仍会保留现有的周总结正文，但主题关联将由于重试机制被先期解绑。 | 增加了 `try-catch` 保护。即使主题提取服务调用失败，周度总结也能保存成功，并优雅记录日志而不影响前端面板的状态显示。 |

---

## 5. 验证标准 (Verification Standards)

在 subagent `code-verification` 中，将通过以下测试标准进行验证：
1. **数据库迁移测试**：升级应用并打开，校验 `themes` 表中已成功存在 `ai_generated` 列，且默认值为 `0`。
2. **多轮重新生成测试**：在总结面板上对同一周多次点击“重新生成”，观察 `themes` 表和 `theme_items` 表，相同周对应的关联数应与最新一轮提取的主题数完全一致，不能发生堆积。
3. **静默清理测试**：观察重新生成前的 AI 主题，若其在重生成后不再被包含，该主题记录应从 `themes` 表中被物理删除。
4. **用户资产保护测试**：手动创建一个未关联的主题，对周总结进行多次重生成，校验手动创建的主题依然安然无恙，不被清理。
