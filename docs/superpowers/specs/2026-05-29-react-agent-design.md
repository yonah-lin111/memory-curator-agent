# ReAct Agent 机制设计

## 目标

在现有 Electron 项目中加入 Claude Code 风格的 Agent Loop：模型负责决策，主进程执行工具，工具结果回灌模型，渲染层以流式方式展示回答和工具步骤。首期只支持两类能力：日常聊天和只读查询 People 表。

## 架构

Agent 运行在主进程，避免 API Key 与数据库能力暴露到渲染进程。渲染进程通过 `ai:chat:start` 发起一次运行，主进程用 `ai:chat:event` 持续推送事件。事件包含文本增量、工具开始、工具完成、完成与错误。

Provider 层负责把统一内部消息转换为不同模型厂商格式。默认读取 `/Users/yonah/.mc/config.json`，默认 provider 为 `bailian`，默认模型为 `MiniMax-M2.5`。首期真实流式执行使用 OpenAI compatible 协议，配置结构保留 `openai`、`anthropic`、`google` 三类 provider 类型，便于后续切换。

## Agent Loop

每轮循环由 `reactAgent` 控制：

1. 将 system prompt、历史消息、可用工具定义发给 provider。
2. provider 流式返回文本增量或工具调用片段。
3. 若模型请求 `people_query`，主进程调用 People 服务读取 `associated_people`。
4. 将工具观察结果追加到消息历史。
5. 若还有工具调用，进入下一轮；否则输出最终回答并结束。

Loop 设置最大轮数，防止模型反复调用工具。首期工具白名单只有 `people_query`，不提供写入工具。

## 工具

`people_query` 返回关联人物列表，支持可选 `query`、`relationship`、`conditions`、`sql`、`limit`。结构化条件过滤在工具层完成，受控 SQL 查询在服务层完成；结果包含姓名、关系、状态、生日、联系方式、标签、完整详情、更新时间。工具输出会被压缩为文本观察，避免把过长 Markdown 原样塞回模型。

## UI 与流式体验

渲染层保留当前黑色主题与 6px 圆角。发送消息后立即插入用户消息和一个空 assistant 消息。收到 `tool_started` 时显示执行中步骤，收到 `tool_finished` 时更新为完成。收到 `text_delta` 时先写入缓冲区，再按固定节奏刷入消息内容，形成打字机效果，避免网络 token 粒度导致 UI 抖动。

## 错误处理

配置缺失、provider 请求失败、工具执行失败都会转成 `error` 事件。UI 将错误写入当前 assistant 消息，状态置为失败，不生成假成功文案。

## 测试

主进程测试覆盖配置解析、OpenAI compatible SSE 解析、People 工具过滤、Agent 工具回灌流程。渲染层测试覆盖发送消息后订阅事件、工具步骤状态更新、文本缓冲输出。
