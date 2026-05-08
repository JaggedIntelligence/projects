import type { Card } from "@autoboard/db";
import type { CardRepository, ProjectRepository } from "@autoboard/db";
import {
  createAddTodoMcpServer,
  ADD_TODO_TOOL_NAME,
  claudeProvider,
  DEFAULT_MODEL,
} from "@autoboard/services";
import { NotFoundError, ValidationError } from "@autoboard/shared";
import { CreateCardUseCase } from "./create-card.js";

const SYSTEM_PROMPT = `You are a task breakdown assistant. Given a description of an application or feature, break it down into actionable todo items.

Rules:
- Output items in a logical order (e.g. project setup first, then core features, then polish).
- For each item use the add_todo tool exactly once.
- Title: short, actionable (e.g. "Set up authentication", "Add user profile page"). Max a few words.
- Description: detailed enough for implementation later. Include acceptance criteria, tech notes, or file paths when relevant.
- Create a comprehensive list; it's better to have more granular items than one vague item.`;

export interface GeneratePlanInput {
  projectId: string;
  description: string;
  abortController?: AbortController;
}

export interface GeneratePlanResult {
  cards: Card[];
}

export class GeneratePlanUseCase {
  private createCard: CreateCardUseCase;

  constructor(
    private cardRepository: CardRepository,
    private projectRepository: ProjectRepository
  ) {
    this.createCard = new CreateCardUseCase(cardRepository);
  }

  async execute(input: GeneratePlanInput): Promise<GeneratePlanResult> {
    if (!input.projectId) throw new ValidationError("projectId is required");
    if (!input.description?.trim())
      throw new ValidationError("description is required");

    const project = await this.projectRepository.getProjectById(
      input.projectId
    );
    if (!project) throw new NotFoundError("Project not found");

    const createdCards: Card[] = [];
    const addTodo = async (title: string, description: string) => {
      const result = await this.createCard.execute({
        title: title.trim(),
        description: description.trim(),
        columnId: "todo",
        projectId: input.projectId,
      });
      createdCards.push(result.card);
      return { id: result.card.id };
    };

    const mcpServer = createAddTodoMcpServer(addTodo);
    const query = claudeProvider.createQuery({
      prompt: input.description.trim(),
      model: DEFAULT_MODEL,
      cwd: project.filePath,
      maxTurns: 50,
      allowedTools: [ADD_TODO_TOOL_NAME],
      mcpServers: { autoboard: mcpServer },
      systemPrompt: SYSTEM_PROMPT,
      enableUserInput: false,
      abortController: input.abortController,
    });

    for await (const _ of query) {
      // Consume to completion; add_todo calls happen via tool execution
    }

    return { cards: createdCards };
  }
}
