# XML Prompt 设计规范（企业级模板）

## 一、设计目标

本规范旨在为复杂 Prompt 提供统一、可扩展、易维护的 XML 结构，使角色定义、上下文、任务、规则、数据和输出彼此隔离，提高大语言模型对 Prompt 的解析能力。

设计原则：

- **单一职责**：一个标签只负责一种信息。
- **层次清晰**：全局配置与任务配置分离。
- **模块化**：各模块可独立维护、复用或替换。
- **可扩展**：允许新增标签而不影响整体结构。
- **高可读性**：便于人工阅读、调试与自动生成。

---

# 二、整体结构

```xml
<prompt>

    <system_role></system_role>

    <objective></objective>

    <context></context>

    <assumptions></assumptions>

    <constraints></constraints>

    <definitions></definitions>

    <variables></variables>

    <resources></resources>

    <tasks>

        <task id="1">

            ...

        </task>

    </tasks>

    <output_format></output_format>

    <validation></validation>

    <input_data></input_data>

</prompt>
```

---

# 三、全局标签说明

## `<system_role>`

### 作用

定义 AI 的身份、专业能力和行为风格。

### 示例

```xml
<system_role>

你是一名资深产品经理。

</system_role>
```

---

## `<objective>`

### 作用

描述整个 Prompt 的最终目标。

### 示例

```xml
<objective>

分析需求文档并输出产品方案。

</objective>
```

---

## `<context>`

### 作用

提供背景信息、业务环境或前置知识。

### 示例

```xml
<context>

这是一个电商平台项目。

</context>
```

---

## `<assumptions>`

### 作用

定义模型在缺少信息时应采用的默认假设。

### 示例

```xml
<assumptions>

- 默认使用最新行业最佳实践
- 未说明国家时默认中国市场

</assumptions>
```

---

## `<constraints>`

### 作用

定义所有任务共同遵守的规则。

### 示例

```xml
<constraints>

- 不编造事实
- 保持客观
- 不输出敏感信息

</constraints>
```

---

## `<definitions>`

### 作用

统一术语、缩写、专业名词的含义。

### 示例

```xml
<definitions>

PRD = 产品需求文档

KPI = 关键绩效指标

</definitions>
```

---

## `<variables>`

### 作用

集中管理 Prompt 中使用的变量。

### 示例

```xml
<variables>

language = 中文

tone = 专业

max_words = 500

</variables>
```

---

## `<resources>`

### 作用

引用可供模型参考的资料。

### 示例

```xml
<resources>

产品规范

API 文档

设计文档

行业标准

</resources>
```

---

# 四、任务模块

## `<tasks>`

所有任务的容器。

每个任务使用 `<task>` 独立描述。

---

## Task 完整结构

```xml
<task id="1">

    <title></title>

    <goal></goal>

    <instructions></instructions>

    <rules></rules>

    <priority></priority>

    <depends_on></depends_on>

    <variables></variables>

    <resources></resources>

    <example></example>

    <output></output>

    <validation></validation>

    <notes></notes>

</task>
```

---

# 五、Task 标签说明

## `<title>`

任务名称。

例如：

```xml
<title>

竞争分析

</title>
```

---

## `<goal>`

任务最终目标。

例如：

```xml
<goal>

分析竞争优势。

</goal>
```

---

## `<instructions>`

具体执行说明。

例如：

```xml
<instructions>

阅读全部资料后分析竞争优势。

</instructions>
```

---

## `<rules>`

当前任务专属规则。

例如：

```xml
<rules>

- 不评价商业模式

- 不重复上一任务

</rules>
```

---

## `<priority>`

任务优先级。

建议：

- High
- Medium
- Low

例如：

```xml
<priority>

High

</priority>
```

---

## `<depends_on>`

表示任务依赖。

例如：

```xml
<depends_on>

Task1

</depends_on>
```

---

## `<variables>`

当前任务变量。

例如：

```xml
<variables>

summary_length = 300

</variables>
```

---

## `<resources>`

当前任务使用资料。

例如：

```xml
<resources>

行业报告

竞争产品资料

</resources>
```

---

## `<example>`

输入输出示例。

用于 Few-shot Prompt。

例如：

```xml
<example>

输入：

……

输出：

……

</example>
```

---

## `<output>`

当前任务输出要求。

例如：

```xml
<output>

Markdown 表格。

</output>
```

---

## `<validation>`

任务完成后的检查规则。

例如：

```xml
<validation>

检查是否遗漏风险。

</validation>
```

---

## `<notes>`

补充说明。

例如：

```xml
<notes>

若资料不足，请说明原因。

</notes>
```

---

# 六、输出模块

## `<output_format>`

定义整个 Prompt 的输出格式。

例如：

```xml
<output_format>

按照 Task 顺序输出。

使用 Markdown。

一级标题对应每个任务。

</output_format>
```

---

## `<validation>`

全局输出检查。

例如：

```xml
<validation>

检查所有任务是否完成。

确认没有违反 Constraints。

确认格式符合 Output Format。

</validation>
```

---

# 七、输入模块

## `<input_data>`

存放所有待处理内容。

可以是：

- 文档
- 代码
- JSON
- Markdown
- SQL
- 日志
- PDF 内容
- 用户输入
- API 返回结果

例如：

```xml
<input_data>

……

</input_data>
```

---

# 八、推荐目录结构

```text
Prompt
│
├── System Role
├── Objective
├── Context
├── Assumptions
├── Constraints
├── Definitions
├── Variables
├── Resources
│
├── Tasks
│     ├── Task 1
│     │      ├── Title
│     │      ├── Goal
│     │      ├── Instructions
│     │      ├── Rules
│     │      ├── Priority
│     │      ├── Depends On
│     │      ├── Variables
│     │      ├── Resources
│     │      ├── Example
│     │      ├── Output
│     │      ├── Validation
│     │      └── Notes
│     │
│     ├── Task 2
│     └── Task N
│
├── Output Format
├── Validation
└── Input Data
```

---

# 九、推荐使用场景

| 标签              | 推荐程度 | 使用场景      |
| ----------------- | -------- | ------------- |
| `<system_role>`   | ★★★★★    | 定义角色      |
| `<objective>`     | ★★★★★    | 明确整体目标  |
| `<context>`       | ★★★★★    | 提供背景信息  |
| `<constraints>`   | ★★★★★    | 全局规则      |
| `<tasks>`         | ★★★★★    | 多任务组织    |
| `<task>`          | ★★★★★    | 单个任务      |
| `<title>`         | ★★★★★    | 任务名称      |
| `<goal>`          | ★★★★★    | 任务目标      |
| `<instructions>`  | ★★★★★    | 执行步骤      |
| `<rules>`         | ★★★★★    | 任务规则      |
| `<output>`        | ★★★★★    | 输出要求      |
| `<output_format>` | ★★★★★    | 全局输出格式  |
| `<input_data>`    | ★★★★★    | 输入数据      |
| `<assumptions>`   | ★★★★☆    | 默认假设      |
| `<definitions>`   | ★★★★☆    | 术语定义      |
| `<variables>`     | ★★★★☆    | 参数配置      |
| `<resources>`     | ★★★★☆    | 参考资料      |
| `<example>`       | ★★★★☆    | Few-shot 示例 |
| `<priority>`      | ★★★☆☆    | 任务调度      |
| `<depends_on>`    | ★★★☆☆    | 任务依赖      |
| `<validation>`    | ★★★★☆    | 输出检查      |
| `<notes>`         | ★★★☆☆    | 补充说明      |
