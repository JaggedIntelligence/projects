import { useEffect, useState, useCallback } from "react";
import KanbanBoard from "~/components/KanbanBoard";
import TopBar from "~/components/TopBar";
import CreateProjectModal from "~/components/CreateProjectModal";
import EditProjectModal from "~/components/EditProjectModal";
import { registerRefetch, openDrawer } from "~/atoms/log-drawer";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getAutoModeStatus,
  toggleAutoMode,
  setAutoModeConcurrency,
  type Project,
} from "~/api";
import type { AutoModeStatus } from "~/api/auto-mode";

export default function Index() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoModeStatus, setAutoModeStatus] = useState<AutoModeStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, refreshKey]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const savedId = localStorage.getItem("selectedProjectId");
      const savedExists = savedId && projects.some((p) => p.id === savedId);
      const id = savedExists ? savedId! : projects[0].id;
      setSelectedProjectId(id);
      localStorage.setItem("selectedProjectId", id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setAutoModeStatus(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getAutoModeStatus(selectedProjectId!);
        if (!cancelled) setAutoModeStatus(status);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedProjectId]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    localStorage.setItem("selectedProjectId", projectId);
  };

  const handleCreateProject = async (name: string, filePath: string) => {
    const newProject = await createProject(name, filePath);
    setIsCreateModalOpen(false);
    setRefreshKey((k) => k + 1);
    setSelectedProjectId(newProject.id);
    localStorage.setItem("selectedProjectId", newProject.id);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      localStorage.removeItem("selectedProjectId");
    }
    setRefreshKey((k) => k + 1);
  };

  const handleEditProject = (project: Project) => setProjectToEdit(project);

  const handleUpdateProject = async (name: string, filePath: string) => {
    if (!projectToEdit) return;
    await updateProject(projectToEdit.id, name, filePath);
    setProjectToEdit(null);
    setRefreshKey((k) => k + 1);
  };

  const handleToggleAutoMode = async (enabled: boolean) => {
    if (!selectedProjectId) return;
    await toggleAutoMode(selectedProjectId, enabled);
    const status = await getAutoModeStatus(selectedProjectId);
    setAutoModeStatus(status);
  };

  const handleSetConcurrency = async (value: number) => {
    if (!selectedProjectId) return;
    await setAutoModeConcurrency(selectedProjectId, value);
    const status = await getAutoModeStatus(selectedProjectId);
    setAutoModeStatus(status);
  };

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  useEffect(() => {
    registerRefetch(refetch);
    return () => registerRefetch(undefined);
  }, [refetch]);

  const hasProjects = projects.length > 0;

  useEffect(() => {
    document.title = "Dashboard - Kanban Board";
  }, []);

  return (
    <>
      {hasProjects ? (
        <>
          <TopBar
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onNewProject={() => setIsCreateModalOpen(true)}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            autoModeEnabled={autoModeStatus?.enabled ?? false}
            autoModeConcurrency={autoModeStatus?.maxConcurrency ?? 1}
            autoModeActiveRuns={autoModeStatus?.activeRunCount ?? 0}
            onToggleAutoMode={handleToggleAutoMode}
            onSetConcurrency={handleSetConcurrency}
          />
          <KanbanBoard
            projectId={selectedProjectId}
            autoModeActive={
              (autoModeStatus?.loopRunning || (autoModeStatus?.activeRunCount ?? 0) > 0) ?? false
            }
            onCardClick={openDrawer}
          />
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state__content">
            <h2 className="empty-state__title">No Projects Yet</h2>
            <p className="empty-state__description">
              Get started by opening a directory to create your first project.
            </p>
            <button
              className="empty-state__button"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Open Directory
            </button>
          </div>
        </div>
      )}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />
      <EditProjectModal
        isOpen={projectToEdit !== null}
        onClose={() => setProjectToEdit(null)}
        onSubmit={handleUpdateProject}
        project={projectToEdit}
      />
    </>
  );
}
