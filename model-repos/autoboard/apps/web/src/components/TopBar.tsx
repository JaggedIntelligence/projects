import { useState } from "react";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import type { Project } from "~/api/projects";

interface TopBarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  autoModeEnabled?: boolean;
  autoModeConcurrency?: number;
  autoModeActiveRuns?: number;
  onToggleAutoMode?: (enabled: boolean) => void;
  onSetConcurrency?: (value: number) => void;
}

export default function TopBar(props: TopBarProps) {
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (
    e: React.MouseEvent,
    projectId: string,
    projectName: string
  ) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, name: projectName });
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await props.onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="top-bar">
        <button
          className="top-bar__open-button"
          onClick={props.onNewProject}
          aria-label="Open Directory"
          title="Open Directory"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <div className="top-bar__tabs">
          {props.projects.map((project) => (
            <div
              key={project.id}
              className={`top-bar__tab ${
                props.selectedProjectId === project.id ? "top-bar__tab--active" : ""
              }`}
              onClick={() => props.onSelectProject(project.id)}
            >
              <span className="top-bar__tab-label">{project.name}</span>
              <button
                className="top-bar__tab-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onEditProject(project);
                }}
                aria-label={`Edit ${project.name}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="top-bar__tab-delete"
                onClick={(e) => handleDeleteClick(e, project.id, project.name)}
                aria-label={`Delete ${project.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {props.selectedProjectId && (
          <div className="top-bar__auto-mode">
            <button
              className={`auto-mode__toggle ${props.autoModeEnabled ? "auto-mode__toggle--active" : ""}`}
              onClick={() => props.onToggleAutoMode?.(!props.autoModeEnabled)}
              title={props.autoModeEnabled ? "Disable auto mode" : "Enable auto mode"}
            >
              <span className="auto-mode__toggle-label">Auto</span>
              <span className="auto-mode__toggle-track">
                <span className="auto-mode__toggle-knob" />
              </span>
            </button>
            {props.autoModeEnabled && (
              <>
                <label className="auto-mode__concurrency">
                  <span className="auto-mode__concurrency-label">Workers:</span>
                  <input
                    type="number"
                    className="auto-mode__concurrency-input"
                    min={1}
                    max={10}
                    value={props.autoModeConcurrency ?? 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= 10) props.onSetConcurrency?.(val);
                    }}
                  />
                </label>
                {(props.autoModeActiveRuns ?? 0) > 0 && (
                  <div className="auto-mode__status">
                    <span className="auto-mode__status-spinner" />
                    <span className="auto-mode__status-count">
                      {props.autoModeActiveRuns}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        isOpen={projectToDelete !== null}
        projectName={projectToDelete?.name ?? ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setProjectToDelete(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
