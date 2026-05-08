import { useEffect } from "react";
import type { Card } from "~/api/cards";

interface ArchivedCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedCards: Card[];
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ArchivedCardsModal(props: ArchivedCardsModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose();
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose();
  };

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!props.isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Archived Cards</h2>
          <button className="modal-close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="archived-modal__content">
          {props.archivedCards.length === 0 ? (
            <div className="archived-modal__empty">
              <p>No archived cards yet.</p>
            </div>
          ) : (
            <div className="archived-modal__list">
              {props.archivedCards.map((card) => (
                <div key={card.id} className="archived-card">
                  <div className="archived-card__title">{card.title || "Untitled"}</div>
                  {card.description && (
                    <div className="archived-card__description">{card.description}</div>
                  )}
                  <div className="archived-card__date">
                    Archived {formatDate(card.archivedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
