/**
 * Domain types for the application.
 * These types are database-agnostic and used throughout the application.
 */

export interface Project {
  id: string;
  name: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  id: string;
  name: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  title: string | null;
  description: string | null;
  columnId: string;
  projectId: string | null;
  sessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CreateCardData {
  id: string;
  title: string | null;
  description: string | null;
  columnId: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCardData {
  columnId?: string;
  title?: string;
  description?: string;
  sessionId?: string | null;
  archivedAt?: Date | null;
  updatedAt: Date;
}

export interface UpdateProjectData {
  name?: string;
  filePath?: string;
  updatedAt: Date;
}

export type CardLogType =
  | "assistant_text"
  | "tool_use"
  | "tool_result"
  | "error"
  | "user_input"
  | "system"
  | "ask_user";

export interface CardLog {
  id: string;
  cardId: string;
  type: CardLogType;
  content: string;
  sequence: number;
  createdAt: Date;
}

export interface AutoModeSettings {
  projectId: string;
  enabled: boolean;
  maxConcurrency: number;
  updatedAt: Date;
}

export interface UpdateAutoModeData {
  enabled?: boolean;
  maxConcurrency?: number;
  updatedAt: Date;
}
