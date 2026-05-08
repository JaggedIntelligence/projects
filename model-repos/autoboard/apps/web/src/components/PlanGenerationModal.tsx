import { useState, useEffect } from "react";

interface PlanGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}

export default function PlanGenerationModal(props: PlanGenerationModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (props.isOpen) {
      setDescription("");
      setIsSubmitting(false);
    }
  }, [props.isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const desc = description.trim();
    setDescription("");
    props.onClose();
    setIsSubmitting(false);
    try {
      await props.onSubmit(desc);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to generate plan.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) props.onClose();
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !isSubmitting) props.onClose();
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
          <h2 className="modal-title">Plan with AI</h2>
          <button
            className="modal-close"
            onClick={props.onClose}
            aria-label="Close"
            type="button"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="plan-description" className="modal-label">
              What do you want to build?
            </label>
            <textarea
              id="plan-description"
              className="modal-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your app or feature idea in as much detail as you like. For example: a todo app with user auth, or add a dark mode toggle to the settings page."
              rows={6}
              required
              disabled={isSubmitting}
            />
          </div>
          <p className="plan-generation-modal__disclaimer">
            This will use AI to generate a breakdown of tasks. It may take a
            minute or two and will create multiple todo items in your To Do
            column.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-button modal-button--secondary"
              onClick={props.onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button--primary"
              disabled={!description.trim() || isSubmitting}
            >
              {isSubmitting ? "Generating…" : "Generate Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
