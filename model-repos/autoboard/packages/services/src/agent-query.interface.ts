/**
 * Interface for agent code query functionality.
 */

export interface AgentMessageContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface AgentMessage {
  type: string;
  subtype?: string;
  message?: {
    content?: AgentMessageContentBlock[];
    [key: string]: unknown;
  };
  session_id?: string;
  result?: unknown;
  [key: string]: unknown;
}

/** MCP server config (e.g. from createSdkMcpServer). Typed loosely to avoid pulling SDK into interface. */
export type McpServerConfig = Record<string, unknown>;

export interface AgentQueryOptions {
  prompt: string;
  model: string;
  cwd: string;
  maxTurns?: number;
  allowedTools?: string[];
  mcpServers?: Record<string, McpServerConfig>;
  permissionMode?: string;
  allowDangerouslySkipPermissions?: boolean;
  env?: Record<string, string | undefined>;
  systemPrompt?: string;
  abortController?: AbortController;
  resume?: string;
}

export type AgentQuery = {
  [Symbol.asyncIterator](): AsyncIterator<AgentMessage>;
  streamInput(message: string): void | Promise<void>;
} & AsyncIterable<AgentMessage>;

export interface IAgentCodeQuery {
  query(options: AgentQueryOptions): AsyncGenerator<AgentMessage>;
  createQuery(
    options: AgentQueryOptions & { enableUserInput?: boolean }
  ): AgentQuery;
}
