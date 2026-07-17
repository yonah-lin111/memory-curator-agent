import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { pathToFileURL } from 'node:url'
import type { AgentTool, AgentToolResult, JsonSchema, McpServerConfig } from '@/agent/types'

// MCP 服务连接失败信息。
export type McpConnectionFailure = {
  // MCP 服务配置。
  server: McpServerConfig
  // 失败原因。
  error: string
}

/**
 * 为 MCP 请求设置超时，避免服务异常阻塞 Agent 会话。
 */
const withTimeout = <T>(operation: Promise<T>, timeout: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout)
    void operation.then(
      (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

// MCP 参数定义中的未知属性保持可调用，避免因服务升级而阻断工具注册。
const toJsonSchema = (value: unknown): JsonSchema => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { type: 'object' }
  }

  const schema = value as Record<string, unknown>
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? Object.fromEntries(
      Object.entries(schema.properties as Record<string, unknown>).map(([name, item]) => [name, toJsonSchema(item)])
    )
    : undefined
  const items = schema.items ? toJsonSchema(schema.items) : undefined
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : undefined
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter((item): item is string => typeof item === 'string')
    : undefined

  return {
    type: typeof schema.type === 'string' ? schema.type : 'object',
    ...(properties ? { properties } : {}),
    ...(items ? { items } : {}),
    ...(required?.length ? { required } : {}),
    ...(enumValues?.length ? { enum: enumValues } : {}),
    ...(typeof schema.description === 'string' ? { description: schema.description } : {})
  }
}

/**
 * 将 MCP 工具结果转换为 Agent 的统一结果格式。
 */
const toAgentToolResult = (result: unknown): AgentToolResult => {
  const text = JSON.stringify(result)

  return {
    observation: text ?? 'MCP tool completed without output.',
    data: result
  }
}

/**
 * 为提示词设计 Agent 连接 MCP 服务并适配其工具定义。
 */
export const createPromptDesignMcpTools = async (
  servers: McpServerConfig[],
  projectRoot: string | null
): Promise<{ tools: AgentTool[]; failures: McpConnectionFailure[]; close: () => Promise<void> }> => {
  const clients: Client[] = []
  const tools: AgentTool[] = []
  const failures: McpConnectionFailure[] = []

  if (!projectRoot) {
    return { tools, failures, close: async () => undefined }
  }

  for (const server of servers) {
    const client = new Client(
      { name: 'memory-curator-agent', version: '0.1.0' },
      { capabilities: { roots: { listChanged: false } } }
    )
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(projectRoot).href, name: server.name }]
    }))
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args
    })

    try {
      await withTimeout(client.connect(transport), server.timeout, `MCP server ${server.name} connection`)
      clients.push(client)
      const listedTools = await withTimeout(client.listTools(), server.timeout, `MCP server ${server.name} tool discovery`)

      for (const tool of listedTools.tools) {
        const name = `mcp_${server.id.replace(/[^a-zA-Z0-9_]/g, '_')}_${tool.name.replace(/[^a-zA-Z0-9_]/g, '_')}`
        tools.push({
          name,
          description: tool.description ?? `MCP tool ${tool.name} from ${server.id}.`,
          parameters: toJsonSchema(tool.inputSchema),
          mcp: { serverId: server.id, serverName: server.name, toolName: tool.name },
          execute: async (input) => toAgentToolResult(
            await withTimeout(
              client.callTool({ name: tool.name, arguments: input as Record<string, unknown> }),
              server.timeout,
              `MCP tool ${server.name}.${tool.name}`
            )
          )
        })
      }
    } catch (error) {
      await transport.close().catch(() => undefined)
      failures.push({ server, error: error instanceof Error ? error.message : String(error) })
      console.error(`Unable to connect MCP server ${server.id}:`, error)
    }
  }

  return {
    tools,
    failures,
    close: async () => {
      await Promise.all(clients.map((client) => client.close().catch(() => undefined)))
    }
  }
}
