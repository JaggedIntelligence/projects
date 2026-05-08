import { useState, useEffect } from "react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, filePath: string) => void;
}

function extractDirectoryName(path: string): string {
  const parts = path.split(/[/\\]/).filter((p) => p.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

export default function CreateProjectModal(props: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");

  useEffect(() => {
    if (props.isOpen) {
      setName("");
      setFilePath("");
    }
  }, [props.isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filePath.trim()) {
      const projectName = name.trim() || extractDirectoryName(filePath.trim());
      props.onSubmit(projectName, filePath.trim());
      setName("");
      setFilePath("");
    }
  };

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
          <h2 className="modal-title">Open Directory</h2>
          <button className="modal-close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="project-path" className="modal-label">
              Project Folder Path <span className="required">*</span>
            </label>
            <input
              id="project-path"
              type="text"
              className="modal-input"
              value={filePath}
              onChange={(e) => {
                const path = e.target.value;
                setFilePath(path);
                if (!name.trim() && path.trim())
                  setName(extractDirectoryName(path.trim()));
              }}
              placeholder="/Users/you/projects/my-app"
              required
              autoFocus
            />
          </div>
          <div className="modal-field">
            <label htmlFor="project-name" className="modal-label">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name (optional)"
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-button modal-button--secondary"
              onClick={props.onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button--primary"
              disabled={!filePath.trim()}
            >
              Open Directory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
