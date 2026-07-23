import { pathToFileURL } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import type { AgentTool, AgentToolResult, JsonSchema, McpServerConfig } from "@/agent/types"

// MCP 服务连接失败信息。
export type McpConnectionFailure = {
  // MCP 服务配置。
  server: McpServerConfig
  // 失败原因。
  error: string
}

// MCP 连接在空闲后保留的时间，避免连续对话反复启动服务进程。
const MCP_CONNECTION_IDLE_TIMEOUT = 60_000

// MCP 连接池条目。
type McpConnectionPoolEntry = {
  client: Client
  tools: AgentTool[]
  references: number
  idleTimer?: NodeJS.Timeout
}

// 正在创建与已创建的连接均以同一键缓存，避免并发请求重复拉起 MCP 服务。
const mcpConnectionPool = new Map<string, Promise<McpConnectionPoolEntry>>()

/**
 * 为项目和服务配置生成稳定的连接池键。
 */
const getConnectionPoolKey = (server: McpServerConfig, projectRoot: string): string =>
  JSON.stringify({
    projectRoot,
    id: server.id,
    command: server.command,
    args: server.args,
    timeout: server.timeout,
  })

/**
 * 为 MCP 请求设置超时，避免服务异常阻塞 Agent 会话。
 */
const withTimeout = <T>(operation: Promise<T>, timeout: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeout}ms`)),
      timeout,
    )
    void operation.then(
      (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

// MCP 参数定义中的未知属性保持可调用，避免因服务升级而阻断工具注册。
const toJsonSchema = (value: unknown): JsonSchema => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "object" }
  }

  const schema = value as Record<string, unknown>
  const properties =
    schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? Object.fromEntries(
          Object.entries(schema.properties as Record<string, unknown>).map(([name, item]) => [
            name,
            toJsonSchema(item),
          ]),
        )
      : undefined
  const items = schema.items ? toJsonSchema(schema.items) : undefined
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : undefined
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter((item): item is string => typeof item === "string")
    : undefined

  return {
    type: typeof schema.type === "string" ? schema.type : "object",
    ...(properties ? { properties } : {}),
    ...(items ? { items } : {}),
    ...(required?.length ? { required } : {}),
    ...(enumValues?.length ? { enum: enumValues } : {}),
    ...(typeof schema.description === "string" ? { description: schema.description } : {}),
  }
}

/**
 * 将 MCP 工具结果转换为 Agent 的统一结果格式。
 */
const toAgentToolResult = (result: unknown): AgentToolResult => {
  const text = JSON.stringify(result)

  return {
    observation: text ?? "MCP tool completed without output.",
    data: result,
  }
}

/**
 * 建立单个 MCP 连接并发现可用工具。
 */
const connectMcpServer = async (
  server: McpServerConfig,
  projectRoot: string,
): Promise<McpConnectionPoolEntry> => {
  const client = new Client(
    { name: "memory-curator-agent", version: "0.1.0" },
    { capabilities: { roots: { listChanged: false } } },
  )
  client.setRequestHandler(ListRootsRequestSchema, async () => ({
    roots: [{ uri: pathToFileURL(projectRoot).href, name: server.name }],
  }))
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
  })

  try {
    await withTimeout(
      client.connect(transport),
      server.timeout,
      `MCP server ${server.name} connection`,
    )
    const listedTools = await withTimeout(
      client.listTools(),
      server.timeout,
      `MCP server ${server.name} tool discovery`,
    )
    const tools = listedTools.tools.map((tool) => ({
      name: `mcp_${server.id.replace(/[^a-zA-Z0-9_]/g, "_")}_${tool.name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      description: tool.description ?? `MCP tool ${tool.name} from ${server.id}.`,
      parameters: toJsonSchema(tool.inputSchema),
      mcp: { serverId: server.id, serverName: server.name, toolName: tool.name },
      execute: async (input: unknown) => executeMcpTool(server, projectRoot, tool.name, input),
    }))

    return { client, tools, references: 0 }
  } catch (error) {
    await transport.close().catch(() => undefined)
    throw error
  }
}

/**
 * 获取 MCP 连接的使用权；同一项目与服务配置复用一个已连接客户端。
 */
const acquireMcpConnection = async (
  server: McpServerConfig,
  projectRoot: string,
): Promise<{ client: Client; tools: AgentTool[]; release: () => Promise<void> }> => {
  const key = getConnectionPoolKey(server, projectRoot)
  let entryPromise = mcpConnectionPool.get(key)

  if (!entryPromise) {
    entryPromise = connectMcpServer(server, projectRoot)
    mcpConnectionPool.set(key, entryPromise)
    void entryPromise.catch(() => {
      if (mcpConnectionPool.get(key) === entryPromise) {
        mcpConnectionPool.delete(key)
      }
    })
  }

  const entry = await entryPromise
  entry.references += 1
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer)
    entry.idleTimer = undefined
  }

  let released = false
  const release = async (): Promise<void> => {
    if (released) return
    released = true
    entry.references = Math.max(0, entry.references - 1)
    if (entry.references > 0 || entry.idleTimer) return

    entry.idleTimer = setTimeout(() => {
      if (entry.references > 0 || mcpConnectionPool.get(key) !== entryPromise) return
      mcpConnectionPool.delete(key)
      entry.idleTimer = undefined
      void entry.client.close().catch(() => undefined)
    }, MCP_CONNECTION_IDLE_TIMEOUT)
    entry.idleTimer.unref?.()
  }

  return { client: entry.client, tools: entry.tools, release }
}

/**
 * 驱逐发生调用错误的连接，确保下一次获取连接时重新建立 MCP 会话。
 */
const invalidateMcpConnection = async (
  key: string,
  entryPromise: Promise<McpConnectionPoolEntry>,
  entry: McpConnectionPoolEntry,
): Promise<void> => {
  if (mcpConnectionPool.get(key) !== entryPromise) return

  mcpConnectionPool.delete(key)
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer)
    entry.idleTimer = undefined
  }
  await entry.client.close().catch(() => undefined)
}

/**
 * 调用 MCP 工具；连接失效时驱逐旧连接并自动重试一次。
 */
const executeMcpTool = async (
  server: McpServerConfig,
  projectRoot: string,
  toolName: string,
  input: unknown,
  shouldRetry = true,
): Promise<AgentToolResult> => {
  const key = getConnectionPoolKey(server, projectRoot)
  const entryPromise = mcpConnectionPool.get(key)
  const connection = await acquireMcpConnection(server, projectRoot)

  try {
    return toAgentToolResult(
      await withTimeout(
        connection.client.callTool({ name: toolName, arguments: input as Record<string, unknown> }),
        server.timeout,
        `MCP tool ${server.name}.${toolName}`,
      ),
    )
  } catch (error) {
    if (!shouldRetry || !entryPromise) throw error

    const entry = await entryPromise.catch(() => undefined)
    if (entry) {
      await invalidateMcpConnection(key, entryPromise, entry)
    }
    return executeMcpTool(server, projectRoot, toolName, input, false)
  } finally {
    await connection.release()
  }
}

/**
 * 关闭全部空闲或活跃的 MCP 连接，用于应用退出等生命周期场景。
 */
export const closePromptDesignMcpConnections = async (): Promise<void> => {
  const entries = await Promise.all(
    [...mcpConnectionPool.values()].map(async (entryPromise) => {
      try {
        return await entryPromise
      } catch {
        return undefined
      }
    }),
  )
  mcpConnectionPool.clear()
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry) return
      if (entry.idleTimer) clearTimeout(entry.idleTimer)
      await entry.client.close().catch(() => undefined)
    }),
  )
}

/**
 * 为提示词设计 Agent 连接 MCP 服务并适配其工具定义。
 */
export const createPromptDesignMcpTools = async (
  servers: McpServerConfig[],
  projectRoot: string | null,
): Promise<{
  tools: AgentTool[]
  failures: McpConnectionFailure[]
  close: () => Promise<void>
}> => {
  const releases: Array<() => Promise<void>> = []
  const tools: AgentTool[] = []
  const failures: McpConnectionFailure[] = []

  if (!projectRoot) {
    return { tools, failures, close: async () => undefined }
  }

  for (const server of servers) {
    try {
      const connection = await acquireMcpConnection(server, projectRoot)
      tools.push(...connection.tools)
      releases.push(connection.release)
    } catch (error) {
      failures.push({ server, error: error instanceof Error ? error.message : String(error) })
      console.error(`Unable to connect MCP server ${server.id}:`, error)
    }
  }

  return {
    tools,
    failures,
    close: async () => {
      await Promise.all(releases.map((release) => release()))
    },
  }
}
