import type { CardRepository } from "@autoboard/db";
import type { ProjectRepository } from "@autoboard/db";
import { cardLogRepository } from "@autoboard/db";
import { cardRunStateService, createAgentQuery, type AgentMessage } from "@autoboard/services";
import { ValidationError, NotFoundError, ConflictError } from "@autoboard/shared";

export interface StartCardRunInput {
  cardId: string;
  prompt?: string;
  model?: string;
}

export interface StartCardRunResult {
  success: boolean;
  cardId: string;
  status: "started";
  projectPath: string;
  prompt: string;
}

export class StartCardRunUseCase {
  constructor(
    private cardRepository: CardRepository,
    private projectRepository: ProjectRepository
  ) {}

  async execute(input: StartCardRunInput): Promise<StartCardRunResult> {
    if (!input.cardId) throw new ValidationError("cardId is required");
    if (cardRunStateService.isRunning(input.cardId)) {
      throw new ConflictError("Card is already being processed");
    }

    const kanbanCard = await this.cardRepository.getCardById(input.cardId);
    if (!kanbanCard) throw new NotFoundError("Card not found");
    if (!kanbanCard.projectId) throw new ValidationError("Card has no associated project");

    const project = await this.projectRepository.getProjectById(kanbanCard.projectId);
    if (!project) throw new NotFoundError("Project not found");

    const projectPath = project.filePath;
    const prompt = input.prompt || kanbanCard.description || kanbanCard.title || "";
    if (!prompt) throw new ValidationError("Card must have a prompt, description, or title");

    const abortController = new AbortController();
    const existingLogs = await cardLogRepository.getLogsByCardId(input.cardId);
    const maxSequence =
      existingLogs.length > 0 ? Math.max(...existingLogs.map((l) => l.sequence)) : 0;

    cardRunStateService.createRun(input.cardId, abortController, maxSequence);
    const resumeSessionId = kanbanCard.sessionId || undefined;

    this.runAgentInBackground(
      input.cardId,
      prompt,
      projectPath,
      input.model,
      abortController,
      resumeSessionId
    );

    return {
      success: true,
      cardId: input.cardId,
      status: "started",
      projectPath,
      prompt,
    };
  }

  private async runAgentInBackground(
    cardId: string,
    prompt: string,
    cwd: string,
    model: string | undefined,
    abortController: AbortController,
    resumeSessionId?: string
  ): Promise<void> {
    const run = cardRunStateService.getRun(cardId);
    if (!run) return;

    try {
      const queryObj = createAgentQuery({
        prompt,
        cwd,
        model,
        abortController,
        enableUserInput: true,
        resume: resumeSessionId,
      });
      cardRunStateService.setQuery(cardId, queryObj);
      let capturedSessionId: string | null = null;

      for await (const msg of queryObj) {
        cardRunStateService.addMessage(cardId, msg as AgentMessage);
        await this.classifyAndPersistMessage(cardId, msg as AgentMessage);
        if (!capturedSessionId && (msg as AgentMessage).session_id) {
          capturedSessionId = (msg as AgentMessage).session_id as string;
        }
      }

      if (capturedSessionId) {
        await this.cardRepository.updateCard(cardId, {
          sessionId: capturedSessionId,
          updatedAt: new Date(),
        }).catch((err) => console.error(`[Card ${cardId}] Failed to save session ID:`, err));
      }

      await this.cardRepository.updateCard(cardId, {
        columnId: "manual-review",
        updatedAt: new Date(),
      });
      const seq = cardRunStateService.emitLog(cardId, "system", "Agent run completed");
      await cardLogRepository.createLog({
        cardId,
        type: "system",
        content: "Agent run completed",
        sequence: seq,
      });
      cardRunStateService.updateRunStatus(cardId, "completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const seq = cardRunStateService.emitLog(cardId, "error", errorMessage);
      await cardLogRepository.createLog({
        cardId,
        type: "error",
        content: errorMessage,
        sequence: seq,
      }).catch(() => {});
      const seq2 = cardRunStateService.emitLog(cardId, "system", `Agent run failed: ${errorMessage}`);
      await cardLogRepository.createLog({
        cardId,
        type: "system",
        content: `Agent run failed: ${errorMessage}`,
        sequence: seq2,
      }).catch(() => {});
      await this.cardRepository.updateCard(cardId, {
        columnId: "manual-review",
        updatedAt: new Date(),
      }).catch(() => {});
      cardRunStateService.updateRunStatus(cardId, "error", errorMessage);
    }
  }

  private async classifyAndPersistMessage(cardId: string, msg: AgentMessage): Promise<void> {
    if (msg.type === "assistant" && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text) {
          const seq = cardRunStateService.emitLog(cardId, "assistant_text", block.text);
          await cardLogRepository.createLog({
            cardId,
            type: "assistant_text",
            content: block.text,
            sequence: seq,
          });
        } else if (block.type === "tool_use") {
          const toolName = (block as any).name || "unknown";
          const toolInput =
            typeof (block as any).input === "string"
              ? (block as any).input
              : JSON.stringify((block as any).input || {});

          if (toolName === "AskUserQuestion") {
            cardRunStateService.setNeedsInput(cardId, true);
            const seq = cardRunStateService.emitLog(cardId, "ask_user", toolInput);
            await cardLogRepository.createLog({
              cardId,
              type: "ask_user",
              content: toolInput,
              sequence: seq,
            });
          } else {
            const content = JSON.stringify({
              tool: toolName,
              input: (block as any).input,
            });
            const seq = cardRunStateService.emitLog(cardId, "tool_use", content);
            await cardLogRepository.createLog({
              cardId,
              type: "tool_use",
              content,
              sequence: seq,
            });
          }
        }
      }
    } else if (msg.type === "result") {
      const content =
        typeof msg.result === "string"
          ? msg.result
          : JSON.stringify(msg.result || msg);
      const truncated = content.length > 2000 ? content.slice(0, 2000) + "..." : content;
      const seq = cardRunStateService.emitLog(cardId, "tool_result", truncated);
      await cardLogRepository.createLog({
        cardId,
        type: "tool_result",
        content: truncated,
        sequence: seq,
      });
    }
  }
}
