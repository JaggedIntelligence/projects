/**
 * Claude Provider - Implementation of IAgentCodeQuery interface.
 */

import {
  query,
  type Options,
  type PermissionMode,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  IAgentCodeQuery,
  AgentQueryOptions,
  AgentMessage,
  AgentQuery,
} from "./agent-query.interface.js";

export const DEFAULT_MODEL = "claude-opus-4-6";

export const TOOL_PRESETS = {
  fullAccess: [
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
    "WebSearch",
    "WebFetch",
  ] as const,
};

const SYSTEM_ENV_VARS = [
  "PATH",
  "HOME",
  "SHELL",
  "TERM",
  "USER",
  "LANG",
  "LC_ALL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
];

export function buildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of SYSTEM_ENV_VARS) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

class ClaudeProvider implements IAgentCodeQuery {
  async *query(options: AgentQueryOptions): AsyncGenerator<AgentMessage> {
    const {
      prompt,
      model,
      cwd,
      maxTurns = 1,
      allowedTools = [],
      mcpServers,
      permissionMode = "bypassPermissions",
      allowDangerouslySkipPermissions = true,
      env = buildEnv(),
      systemPrompt,
      abortController,
      resume,
    } = options;

    const sdkOptions: Options = {
      model,
      cwd,
      maxTurns,
      allowedTools,
      permissionMode: permissionMode as PermissionMode,
      allowDangerouslySkipPermissions,
      env,
      ...(systemPrompt && { systemPrompt }),
      ...(abortController && { abortController }),
      ...(resume && { resume }),
      ...(mcpServers &&
        Object.keys(mcpServers).length > 0 && {
          mcpServers: mcpServers as Options["mcpServers"],
        }),
    };

    const stream = query({ prompt, options: sdkOptions });
    for await (const msg of stream) {
      yield msg as AgentMessage;
    }
  }

  createQuery(
    options: AgentQueryOptions & { enableUserInput?: boolean }
  ): AgentQuery {
    const {
      prompt,
      model,
      cwd,
      maxTurns = 500,
      allowedTools = [],
      mcpServers,
      permissionMode = "bypassPermissions",
      allowDangerouslySkipPermissions = true,
      env = buildEnv(),
      systemPrompt,
      abortController,
      resume,
      enableUserInput,
    } = options;

    const tools = enableUserInput
      ? [...allowedTools, "AskUserQuestion"]
      : allowedTools;
    const sdkOptions: Options = {
      model,
      cwd,
      maxTurns,
      allowedTools: tools.length > 0 ? tools : [...TOOL_PRESETS.fullAccess],
      permissionMode: permissionMode as PermissionMode,
      allowDangerouslySkipPermissions,
      env,
      ...(systemPrompt && { systemPrompt }),
      ...(abortController && { abortController }),
      ...(resume && { resume }),
      ...(mcpServers &&
        Object.keys(mcpServers).length > 0 && {
          mcpServers: mcpServers as Options["mcpServers"],
        }),
    };

    const sdkQuery = query({ prompt, options: sdkOptions });
    const queryWrapper: AgentQuery = {
      async *[Symbol.asyncIterator]() {
        yield* sdkQuery;
      },
      streamInput: (message: string) => {
        const messageIterable = async function* () {
          yield {
            type: "user" as const,
            message: message,
            parent_tool_use_id: null,
          } as any;
        };
        return (sdkQuery.streamInput as any)(messageIterable());
      },
    };
    return queryWrapper;
  }
}

export const claudeProvider = new ClaudeProvider();
