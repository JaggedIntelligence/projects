/**
 * Agent Service - Convenience wrapper around ClaudeProvider.
 */

import { claudeProvider, TOOL_PRESETS, DEFAULT_MODEL } from "./claude-provider.js";
import type { AgentMessage } from "./agent-query.interface.js";

export { TOOL_PRESETS, DEFAULT_MODEL };
export type { AgentMessage };

export interface RunAgentOptions {
  prompt: string;
  cwd: string;
  model?: string;
  systemPrompt?: string;
  abortController?: AbortController;
  maxTurns?: number;
  resume?: string;
}

export async function* runAgent(options: RunAgentOptions): AsyncGenerator<AgentMessage> {
  yield* claudeProvider.query({
    prompt: options.prompt,
    model: options.model || DEFAULT_MODEL,
    cwd: options.cwd,
    maxTurns: options.maxTurns || 500,
    allowedTools: [...TOOL_PRESETS.fullAccess],
    systemPrompt: options.systemPrompt,
    abortController: options.abortController,
    resume: options.resume,
  });
}

export async function runAgentToCompletion(options: RunAgentOptions): Promise<AgentMessage[]> {
  const messages: AgentMessage[] = [];
  for await (const msg of runAgent(options)) messages.push(msg);
  return messages;
}

export function createAgentQuery(options: RunAgentOptions & { enableUserInput?: boolean }) {
  return claudeProvider.createQuery({
    prompt: options.prompt,
    model: options.model || DEFAULT_MODEL,
    cwd: options.cwd,
    maxTurns: options.maxTurns || 500,
    allowedTools: [...TOOL_PRESETS.fullAccess],
    systemPrompt: options.systemPrompt,
    abortController: options.abortController,
    resume: options.resume,
    enableUserInput: options.enableUserInput,
  });
}
