import type { IAutoModeLoop } from "@autoboard/shared";
import {
  cardRepository,
  projectRepository,
  autoModeSettingsRepository,
} from "@autoboard/db";
import { StartCardRunUseCase } from "@autoboard/domain";
import { cardRunStateService } from "@autoboard/services";

interface LoopState {
  intervalId: ReturnType<typeof setInterval>;
  activeCardIds: Set<string>;
  isProcessing: boolean;
}

class AutoModeLoop implements IAutoModeLoop {
  private loops = new Map<string, LoopState>();
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const enabledSettings = await autoModeSettingsRepository.getAllEnabled();
      for (const settings of enabledSettings) {
        this.startLoop(settings.projectId);
      }
      if (enabledSettings.length > 0) {
        console.log(
          `[AutoMode] Restored ${enabledSettings.length} auto mode loop(s) from DB`
        );
      }
    } catch (error) {
      console.error("[AutoMode] Failed to restore loops from DB:", error);
    }
  }

  startLoop(projectId: string): void {
    if (this.loops.has(projectId)) return;
    const state: LoopState = {
      intervalId: setInterval(() => this.poll(projectId), 3000),
      activeCardIds: new Set(),
      isProcessing: false,
    };
    this.loops.set(projectId, state);
    this.poll(projectId);
  }

  stopLoop(projectId: string): void {
    const state = this.loops.get(projectId);
    if (!state) return;
    clearInterval(state.intervalId);
    this.loops.delete(projectId);
  }

  getStatus(projectId: string): {
    loopRunning: boolean;
    activeRunCount: number;
    activeCardIds: string[];
  } {
    const state = this.loops.get(projectId);
    return {
      loopRunning: this.loops.has(projectId),
      activeRunCount: state ? state.activeCardIds.size : 0,
      activeCardIds: state ? Array.from(state.activeCardIds) : [],
    };
  }

  private async poll(projectId: string): Promise<void> {
    const state = this.loops.get(projectId);
    if (!state || state.isProcessing) return;

    state.isProcessing = true;
    try {
      const settings = await autoModeSettingsRepository.getByProjectId(projectId);
      if (!settings || !settings.enabled) {
        this.stopLoop(projectId);
        return;
      }

      // 1. Fetch cards first (needed for both counting and picking)
      const allCards = await cardRepository.getCardsByProjectId(projectId);
      const inProgressCards = allCards.filter((c) => c.columnId === "in-progress");

      // 2. Sync activeCardIds: add DB in-progress cards, remove completed/error from cardRunStateService
      for (const card of inProgressCards) {
        state.activeCardIds.add(card.id);
      }
      for (const cardId of state.activeCardIds) {
        const run = cardRunStateService.getRun(cardId);
        if (!run || run.status === "completed" || run.status === "error") {
          state.activeCardIds.delete(cardId);
        }
      }

      // 3. Use DB count for available slots (source of truth)
      const availableSlots = settings.maxConcurrency - inProgressCards.length;
      if (availableSlots <= 0) return;

      const todoCards = allCards.filter((c) => c.columnId === "todo");
      const cardsToRun = todoCards.slice(0, availableSlots);

      const useCase = new StartCardRunUseCase(cardRepository, projectRepository);

      for (const card of cardsToRun) {
        if (cardRunStateService.isRunning(card.id)) {
          state.activeCardIds.add(card.id);
          continue;
        }
        try {
          await cardRepository.updateCard(card.id, {
            columnId: "in-progress",
            updatedAt: new Date(),
          });
          await useCase.execute({ cardId: card.id });
          state.activeCardIds.add(card.id);
        } catch (error) {
          console.error(`[AutoMode] Failed to start card ${card.id}:`, error);
          try {
            await cardRepository.updateCard(card.id, {
              columnId: "todo",
              updatedAt: new Date(),
            });
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      console.error(`[AutoMode] Poll error for project ${projectId}:`, error);
    } finally {
      state.isProcessing = false;
    }
  }
}

export const autoModeLoop = new AutoModeLoop();
