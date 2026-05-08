import type { Card } from "@autoboard/db";
import type { CardRepository } from "@autoboard/db";
import type { ProjectRepository } from "@autoboard/db";
import type { IAgentCodeQuery } from "@autoboard/services";
import { ValidationError, NotFoundError } from "@autoboard/shared";

export interface GenerateCardTitleInput {
  cardId: string;
}

export interface GenerateCardTitleResult {
  title: string;
  card: Card;
}

export class GenerateCardTitleUseCase {
  constructor(
    private cardRepository: CardRepository,
    private projectRepository: ProjectRepository,
    private agentQuery: IAgentCodeQuery
  ) {}

  async execute(input: GenerateCardTitleInput): Promise<GenerateCardTitleResult> {
    if (!input.cardId) throw new ValidationError("cardId is required");

    const kanbanCard = await this.cardRepository.getCardById(input.cardId);
    if (!kanbanCard) throw new NotFoundError("Card not found");
    if (kanbanCard.title) return { title: kanbanCard.title, card: kanbanCard };
    if (!kanbanCard.description) {
      throw new ValidationError("Card must have a description to generate title");
    }
    if (!kanbanCard.projectId) {
      throw new ValidationError("Card must be associated with a project");
    }

    const project = await this.projectRepository.getProjectById(kanbanCard.projectId);
    if (!project) throw new NotFoundError("Project not found");

    const projectPath = project.filePath;
    const prompt = `Based on the following feature description, generate a concise, descriptive title (maximum 60 characters). Return only the title, nothing else.

Description: ${kanbanCard.description}`;

    const stream = this.agentQuery.query({
      prompt,
      model: "claude-opus-4-6",
      cwd: projectPath,
      maxTurns: 50,
      allowedTools: [],
    });

    let generatedTitle = "";
    for await (const msg of stream) {
      const msgAny = msg as any;
      if (msgAny.type === "assistant" && msgAny.message?.content) {
        const textBlocks = msgAny.message.content.filter((b: any) => b.type === "text");
        if (textBlocks.length > 0) {
          generatedTitle = ((textBlocks[0] as any).text || "").trim();
          break;
        }
      }
    }

    if (!generatedTitle) throw new Error("Failed to generate title - no response from agent");

    let cleanedTitle = generatedTitle.replace(/^["']|["']$/g, "");
    cleanedTitle = cleanedTitle.substring(0, 60).trim();
    if (!cleanedTitle) throw new Error("Failed to generate title - empty result");

    const updatedCard = await this.cardRepository.updateCard(input.cardId, {
      title: cleanedTitle,
      updatedAt: new Date(),
    });
    return { title: cleanedTitle, card: updatedCard };
  }
}
