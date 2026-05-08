import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import KanbanCard from "./KanbanCard";
import type { Card } from "~/api/cards";

interface Column {
  id: string;
  title: string;
}

interface KanbanColumnProps {
  column: Column;
  icon?: ReactNode;
  cards: Card[];
  onDeleteCard: (cardId: string) => void;
  onCreateCard?: () => void;
  onPlanWithAI?: () => void;
  isGeneratingPlan?: boolean;
  onStopPlanGeneration?: () => void;
  onArchiveCard?: (cardId: string) => void;
  onStopCard?: (cardId: string) => void;
  onViewArchived?: () => void;
  onCardClick?: (cardId: string) => void;
}

export default function KanbanColumn(props: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: props.column.id });
  const isEmpty = props.cards.length === 0;
  const isTodoColumn = props.column.id === "todo";

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column kanban-column--${props.column.id} ${
        isOver ? "kanban-column--active" : ""
      }`}
    >
      <div className="kanban-column__header">
        <div className="kanban-column__header-left">
          {props.icon && (
            <span className="kanban-column__icon" aria-hidden>
              {props.icon}
            </span>
          )}
          <h2 className="kanban-column__title">{props.column.title}</h2>
          <span className="kanban-column__count">{props.cards.length}</span>
        </div>
        {props.isGeneratingPlan && props.onStopPlanGeneration ? (
          <button
            className="kanban-column__stop-plan-btn"
            onClick={props.onStopPlanGeneration}
            type="button"
            aria-label="Stop generating"
            title="Stop generating"
          >
            <span className="kanban-column__stop-plan-btn-spinner" />
            <svg
              className="kanban-column__stop-plan-btn-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
              <path d="M5 8l.5 1.5L7 10l-1.5.5L5 12l-.5-1.5L3 10l1.5-.5L5 8z" />
            </svg>
            Stop
          </button>
        ) : props.onPlanWithAI ? (
          <button
            className="kanban-column__plan-btn"
            onClick={props.onPlanWithAI}
            type="button"
            aria-label="Plan with AI"
            title="Plan with AI"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
              <path d="M5 8l.5 1.5L7 10l-1.5.5L5 12l-.5-1.5L3 10l1.5-.5L5 8z" />
            </svg>
          </button>
        ) : null}
        {props.onViewArchived && (
          <button
            className="kanban-column__view-archived"
            onClick={props.onViewArchived}
            type="button"
            aria-label="View archived cards"
            title="View archived cards"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </button>
        )}
        {props.onCreateCard && (
          <button
            className="kanban-column__add-btn"
            onClick={props.onCreateCard}
            type="button"
            aria-label="Add item"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
      <div className="kanban-column__content">
        {!isEmpty ? (
          props.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={props.onDeleteCard}
              onArchive={props.onArchiveCard}
              onStopCard={props.onStopCard}
              onClick={
                props.onCardClick
                  ? () => props.onCardClick?.(card.id)
                  : undefined
              }
            />
          ))
        ) : isTodoColumn && props.onCreateCard ? (
          <div className="kanban-column__empty kanban-column__empty--actionable">
            <div className="kanban-column__empty-icon">{props.icon}</div>
            <p className="kanban-column__empty-text">No items yet</p>
            <button
              className="kanban-column__create-button"
              onClick={props.onCreateCard}
              type="button"
            >
              Create New Item
            </button>
          </div>
        ) : (
          <div className="kanban-column__empty">
            <div className="kanban-column__empty-icon">{props.icon}</div>
            <p className="kanban-column__empty-text">No items yet</p>
          </div>
        )}
      </div>
      {props.onCreateCard && (
        <button
          className="kanban-column__add-bottom"
          onClick={props.onCreateCard}
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add item
        </button>
      )}
    </div>
  );
}
