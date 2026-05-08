import { useEffect } from "react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function ConfirmDeleteModal(props: ConfirmDeleteModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) props.onCancel();
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onCancel();
  };

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!props.isOpen) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Delete Project</h2>
          <button className="modal-close" onClick={props.onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-form">
          <p className="modal-message">
            Are you sure you want to delete <strong>{props.projectName}</strong>?
            All associated cards will be deleted. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-button modal-button--secondary"
              onClick={props.onCancel}
              disabled={props.isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal-button modal-button--danger"
              onClick={props.onConfirm}
              disabled={props.isDeleting}
            >
              {props.isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
