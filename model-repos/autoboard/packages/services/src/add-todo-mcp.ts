/**
 * MCP server with add_todo tool for plan generation.
 * The agent uses this tool to insert generated todo items into the board.
 */

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const ADD_TODO_SERVER_NAME = "autoboard";

export interface AddTodoCallback {
  (title: string, description: string): Promise<{ id: string }>;
}

/**
 * Creates an MCP server with a single add_todo tool. The tool handler calls
 * the provided callback to persist each todo (e.g. via CreateCardUseCase).
 * Pass the returned config in AgentQueryOptions.mcpServers and allow
 * the tool via allowedTools: ["mcp__autoboard__add_todo"].
 */
export function createAddTodoMcpServer(addTodo: AddTodoCallback) {
  return createSdkMcpServer({
    name: ADD_TODO_SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        "add_todo",
        "Add a single todo item to the board. Call this once per task. Use a clear, short title and a detailed description suitable for implementation.",
        {
          title: z
            .string()
            .describe(
              "Short, actionable title for the todo (e.g. 'Set up authentication')"
            ),
          description: z
            .string()
            .describe(
              "Detailed description: acceptance criteria, tech notes, or file paths if relevant"
            ),
        },
        async (args) => {
          try {
            const result = await addTodo(args.title, args.description);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Added todo with id: ${result.id}`,
                },
              ],
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error adding todo: ${message}`,
                },
              ],
              is_error: true,
            };
          }
        }
      ),
    ],
  });
}

export const ADD_TODO_TOOL_NAME =
  `mcp__${ADD_TODO_SERVER_NAME}__add_todo` as const;
