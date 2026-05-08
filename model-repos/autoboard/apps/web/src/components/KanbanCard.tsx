import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "~/api/cards";

interface KanbanCardProps {
  card: Card;
  onDelete: (cardId: string) => void;
  onArchive?: (cardId: string) => void;
  onStopCard?: (cardId: string) => void;
  onClick?: () => void;
}

export function CardContent({ card }: { card: Card }) {
  return (
    <>
      <div className="kanban-card__title">
        {card.generatingTitle ? (
          <div className="kanban-card__title-generating">
            <span className="kanban-card__spinner" />
            <span>Generating title...</span>
          </div>
        ) : card.title ? (
          card.title
        ) : (
          <span className="kanban-card__title-placeholder">Untitled</span>
        )}
      </div>
      {card.description && (
        <div className="kanban-card__description">{card.description}</div>
      )}
      {card.isRunning && (
        <div className="kanban-card__progress-bar" title="Card is running">
          <div className="kanban-card__progress-bar-inner" />
        </div>
      )}
      {card.needsInput && (
        <span className="kanban-card__needs-input-badge" title="Agent needs your input">
          !
        </span>
      )}
    </>
  );
}

export default function KanbanCard(props: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.card.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.card.id);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onArchive?.(props.card.id);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onStopCard?.(props.card.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".kanban-card__actions")) return;
    props.onClick?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? "kanban-card--dragging" : ""} ${props.onClick ? "kanban-card--clickable" : ""}`}
    >
      <div
        className="kanban-card__body"
        {...listeners}
        {...attributes}
        onClick={handleClick}
      >
        <CardContent card={props.card} />
      </div>
      <div className="kanban-card__actions">
        {props.card.isRunning && props.onStopCard && (
          <button
            className="kanban-card__stop"
            onClick={handleStop}
            aria-label="Stop agent"
            title="Stop agent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        )}
        {props.onArchive && props.card.columnId !== "manual-review" && (
          <button
            className="kanban-card__archive"
            onClick={handleArchive}
            aria-label="Archive card"
            title="Archive card"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </button>
        )}
        <button
          className="kanban-card__delete"
          onClick={handleDelete}
          aria-label="Delete card"
          title="Delete card"
        >
          ×
        </button>
      </div>
    </div>
  );
}
