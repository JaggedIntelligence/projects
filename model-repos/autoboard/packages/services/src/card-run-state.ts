import { EventEmitter } from "events";
import type { AgentMessage } from "./agent-query.interface.js";

export interface CardRunState {
  abortController: AbortController;
  messages: AgentMessage[];
  status: "running" | "completed" | "error";
  error?: string;
  query?: any;
  needsInput: boolean;
  sequenceCounter: number;
}

export interface LogEvent {
  cardId: string;
  type: string;
  content: string;
  sequence: number;
}

class CardRunStateService {
  private activeRuns = new Map<string, CardRunState>();
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  getRun(cardId: string): CardRunState | undefined {
    return this.activeRuns.get(cardId);
  }

  isRunning(cardId: string): boolean {
    const run = this.activeRuns.get(cardId);
    return run?.status === "running";
  }

  createRun(cardId: string, abortController: AbortController, initialSequence: number = 0): void {
    this.activeRuns.set(cardId, {
      abortController,
      messages: [],
      status: "running",
      needsInput: false,
      sequenceCounter: initialSequence,
    });
    this.emitter.emit(`statusChange:${cardId}`, { cardId, status: "running" });
  }

  updateRunStatus(cardId: string, status: "running" | "completed" | "error", error?: string): void {
    const run = this.activeRuns.get(cardId);
    if (run) {
      run.status = status;
      if (error) run.error = error;
      this.emitter.emit(`statusChange:${cardId}`, { cardId, status, error });
    }
  }

  addMessage(cardId: string, message: AgentMessage): void {
    const run = this.activeRuns.get(cardId);
    if (run) run.messages.push(message);
  }

  emitLog(cardId: string, type: string, content: string): number {
    const run = this.activeRuns.get(cardId);
    if (!run) return 0;
    run.sequenceCounter++;
    const sequence = run.sequenceCounter;
    this.emitter.emit(`log:${cardId}`, { cardId, type, content, sequence });
    return sequence;
  }

  setNeedsInput(cardId: string, needsInput: boolean): void {
    const run = this.activeRuns.get(cardId);
    if (run) {
      run.needsInput = needsInput;
      this.emitter.emit(`needsInput:${cardId}`, { cardId, needsInput });
    }
  }

  setQuery(cardId: string, queryObj: any): void {
    const run = this.activeRuns.get(cardId);
    if (run) run.query = queryObj;
  }

  getAllRuns(): Map<string, CardRunState> {
    return this.activeRuns;
  }

  onLog(cardId: string, handler: (event: LogEvent) => void): () => void {
    const eventName = `log:${cardId}`;
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }

  onStatusChange(
    cardId: string,
    handler: (event: { cardId: string; status: string; error?: string }) => void
  ): () => void {
    const eventName = `statusChange:${cardId}`;
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }

  onNeedsInput(
    cardId: string,
    handler: (event: { cardId: string; needsInput: boolean }) => void
  ): () => void {
    const eventName = `needsInput:${cardId}`;
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }

  cancelRun(cardId: string): void {
    const run = this.activeRuns.get(cardId);
    if (run && run.status === "running") {
      run.abortController.abort();
      run.status = "error";
      run.error = "Cancelled by user";
      this.emitter.emit(`statusChange:${cardId}`, {
        cardId,
        status: "error",
        error: "Cancelled by user",
      });
    }
  }

  removeRun(cardId: string): void {
    this.activeRuns.delete(cardId);
  }
}

export const cardRunStateService = new CardRunStateService();
