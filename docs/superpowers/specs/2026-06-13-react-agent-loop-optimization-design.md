# ReAct Agent 循环优化设计文档

> 参考 opencode-dev 实现，解决模型反复调用同一工具后停止回答的 bug。

## 背景

当前 ReAct Agent 循环存在以下问题：

1. 模型在单次对话中反复调用 `people_tool_query` 等查询工具，5 轮后因 `maxTurns` 硬限制抛错
2. 系统缺少对重复调用的检测和约束
3. 到达 max turns 时直接抛错而非优雅降级
4. 无上下文溢出检测，旧工具结果可能撑爆 context window
5. System prompt 没有明确禁止重复调用

## 优化方案（4 维度）

---

### 维度 1：System Prompt 反重复约束

**文件**：`src/main/ipc/aiHandlers.ts`

在 `SYSTEM_PROMPT_SECTIONS` 的工具边界段落后新增：

```
工具效率：不要用相同参数反复调用同一工具。如果查询已返回结果，直接基于结果回答，不要重新查询同一数据。对于搜索型工具，一次调用即可覆盖需求，无需重复尝试不同措辞。
```

**改动量**：1 行

---

### 维度 2：Max Turns 注入提示

**文件**：`src/main/agent/core/reactAgent.ts`

当 loop 到达 `maxTurns` 上限时，不再 `throw new Error`，改为：

1. 向 `messages` 注入一条 `role: 'user'` 消息：
   ```
   已到达最大工具调用轮数（5 轮）。请基于当前已有的所有工具结果，用纯文本直接回答用户的问题。不要再调用任何工具。
   ```
2. 用 `provider.streamTurn`（不带 tools 参数）让模型生成纯文本最终回答
3. 流式输出这个最终回答后正常 `yield done`

**边界情况**：
- 如果 max turns 注入后模型仍输出 tool calls，忽略并结束
- 如果模型输出为空，回退到现有错误信息但以 text_delta 形式输出

---

### 维度 3：Doom Loop 检测

**文件**：`src/main/agent/core/reactAgent.ts`

**常量**：`DOOM_LOOP_THRESHOLD = 3`

**检测逻辑**（在每轮的工具执行循环中）：

1. 维护一个运行中的工具调用历史（仅记录当次 ReAct run 内的调用）
2. 对每个即将执行的工具调用：
   - 查找最近 3 个已完成工具调用
   - 若 3 个均为 **同 toolName + 同 JSON.stringify(input)**，判定为 doom loop
3. 命中 doom loop 时：
   - 向 `messages` 注入一条 `role: 'tool'` 消息（使用该 tool call 的 ID 和 name）：
     ```
     STOP: You have called this tool with identical arguments 3 times. 
     Use the existing results from previous calls. Do not call this tool again.
     ```
   - **跳过实际 `tool.execute()`**
   - yield `tool_failed` 事件供前端展示
   - continue 到下一个 tool call
4. 如果当前轮所有 tool calls 都被 doom loop 拦截，该轮视为无有效工具调用 → yield done

**数据结构**：
```typescript
type ToolCallRecord = {
  name: string
  input: unknown
  // 不存时间戳，靠数组顺序
}
const toolCallHistory: ToolCallRecord[] = []
```

**边界情况**：
- toolCallHistory 永远只保留最近 `DOOM_LOOP_THRESHOLD` 条
- 写入型工具（add/update/delete）不参与 doom loop 检测（这些有 confirmation，不会自动循环）
- common_tool_ask 不参与 doom loop 检测

---

### 维度 4：上下文 Overflow Compaction

**文件**：
- `src/main/agent/core/contextMessages.ts`（溢出检测 + compaction 逻辑）
- `src/main/agent/core/reactAgent.ts`（轮间调用 compaction）
- `src/main/agent/providers/providerConfig.ts`（新增 compaction 模型配置）

#### 4.1 Provider Config 扩展

在 provider 配置中新增 compaction 字段：

```typescript
compaction?: {
  provider: string  // 用于 compaction 的 provider ID
  model: string     // 用于 compaction 的 model ID
}
```

不配置时 fallback 到当前对话使用的模型。

#### 4.2 溢出检测

每轮结束后估算 `messages` 数组的总 token 数：

```
totalTokens ≈ sum(charCount(message.content) / 4)
```

当 `totalTokens >= contextLimit - COMPACTION_BUFFER(4096)` 时触发 compaction。

#### 4.3 Compaction 流程

1. **保留尾部**：identify 最后 `TAIL_TURNS = 2` 轮（以 `role: 'assistant' + toolCalls` 为轮边界）
2. **提取历史**：取前面所有轮次的消息
3. **总结**：调用 compaction 模型，输入为历史消息 + 总结指令，输出为一段中文摘要
4. **替换**：用一条 `role: 'user'` 消息替换所有历史消息：
   ```
   [上下文已压缩。以下是之前对话的摘要。如果需要之前讨论的细节请基于摘要继续，或向用户确认。]
   
   {compaction 模型生成的摘要}
   ```
5. **注入提示**：紧跟一条 `role: 'user'` 消息：
   ```
   上下文已压缩，如需继续之前的工作请基于以上摘要，或使用工具查询补充信息。
   ```
6. **继续循环**：不做 `yield done`，让模型看到压缩后的上下文继续当前轮次

#### 4.4 Compaction 总结指令

```
你是一个对话摘要助手。请用简洁的中文总结以下对话历史和工具调用结果。

要求：
- 保留关键事实和数据（人物、日期、数字、决策）
- 保留待处理的任务和用户请求
- 省略工具调用的技术细节（SQL 语句、工具名等）
- 用 3-5 段话完成，每段不超过 3 句
- 直接输出摘要，不要加任何前缀或解释
```

#### 4.5 消息选取逻辑

以 `role: 'assistant'` + `toolCalls` 为轮边界，逐轮分割消息：

```
message[0]: system
message[1]: user (第一问)
message[2]: assistant + toolCalls (第1轮)
message[3]: tool result 1
message[4]: tool result 2
message[5]: assistant + toolCalls (第2轮)
message[6]: tool result 3
message[7]: assistant (纯文本，done)
```

保留最后 2 轮所有消息，前面所有轮次送去 compaction。

**边界情况**：
- 总消息数不足 TAIL_TURNS * 2 时，不触发 compaction（即使溢出，也只能截断）
- Compaction 模型调用失败时，fallback 到轻量截断：对旧工具结果执行 `compressContent`
- Compaction 期间不影响用户的主对话流（在主 ReAct run 的循环内同步执行）

---

## 文件改动汇总

| 文件 | 改动内容 |
|------|---------|
| `src/main/ipc/aiHandlers.ts` | 系统提示词新增反重复约束 |
| `src/main/agent/core/reactAgent.ts` | max turns 注入提示、doom loop 检测、轮间 compaction 调用 |
| `src/main/agent/core/contextMessages.ts` | 新增 overflow 检测、compaction 执行、turn 分割逻辑 |
| `src/main/agent/providers/providerConfig.ts` | 新增 compaction provider/model 字段 |

## 实施顺序

1. 维度 1（1 行改动，无风险）
2. 维度 2（改动 max turns 结束逻辑，中等风险）
3. 维度 3（新增 doom loop 检测，低风险）
4. 维度 4（compaction，高风险，最后做）

## 不做的

- 不在前端增加 doom loop 确认 UI（选择静默注入方案）
- 不对写入型工具（带 confirmation）做 doom loop 检测
- 不做 inter-run（跨对话）的 compaction，只做 intra-run（单次 ReAct 内）
