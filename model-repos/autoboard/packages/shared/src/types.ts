/**
 * Shared DTOs used by API and web client.
 */

export interface Card {
  id: string;
  title: string | null;
  description?: string | null;
  columnId: string;
  projectId: string;
  createdAt?: Date;
  updatedAt?: Date;
  archivedAt?: Date | null;
  generatingTitle?: boolean;
  needsInput?: boolean;
  isRunning?: boolean;
}

export interface CreateCardParams {
  title?: string;
  description?: string;
  columnId: string;
  projectId: string;
}

export interface UpdateCardParams {
  columnId?: string;
  title?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoModeStatus {
  enabled: boolean;
  maxConcurrency: number;
}

/** Implemented by apps/api for auto-mode loop control; injected into domain use cases */
export interface IAutoModeLoop {
  startLoop(projectId: string): void;
  stopLoop(projectId: string): void;
  getStatus(projectId: string): {
    loopRunning: boolean;
    activeRunCount: number;
    activeCardIds: string[];
  };
}
