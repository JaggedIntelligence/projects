import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import CreateCardModal from "./CreateCardModal";
import PlanGenerationModal from "./PlanGenerationModal";
import ArchivedCardsModal from "./ArchivedCardsModal";
import {
  getCards,
  createCard,
  updateCard,
  deleteCard,
  archiveCard,
  getArchivedCards,
  generateTitle,
  runCard,
  cancelRun,
  getNeedsInput,
  getRunningCards,
  generatePlan,
  getPlanGenerationStatus,
  cancelPlanGeneration,
} from "~/api";
import type { Card } from "~/api/cards";

const COLUMN_ICONS: Record<string, ReactNode> = {
  todo: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  ),
  "in-progress": (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="10 8 16 12 10 16 10 8"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  ),
  "manual-review": (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  done: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "manual-review", title: "Manual Review" },
  { id: "done", title: "Done" },
];

interface KanbanBoardProps {
  projectId: string | null;
  autoModeActive?: boolean;
  onCardClick?: (cardId: string, title?: string, description?: string) => void;
}

export default function KanbanBoard(props: KanbanBoardProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [needsInputMap, setNeedsInputMap] = useState<Record<string, boolean>>(
    {}
  );
  const [runningCardsMap, setRunningCardsMap] = useState<
    Record<string, boolean>
  >({});
  const [generatingTitles, setGeneratingTitles] = useState<Set<string>>(
    new Set()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const planGenerationCancelledRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const loadCards = useCallback(async () => {
    if (!props.projectId) return;
    try {
      const data = await getCards(props.projectId);
      setCards(data);
    } catch (e) {
      console.error(e);
    }
  }, [props.projectId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (!props.projectId) return;
    getPlanGenerationStatus(props.projectId)
      .then(({ isGenerating }) => {
        if (isGenerating) setIsGeneratingPlan(true);
      })
      .catch(() => {});
  }, [props.projectId]);

  useEffect(() => {
    if (isArchivedModalOpen && props.projectId) {
      getArchivedCards(props.projectId)
        .then(setArchivedCards)
        .catch(console.error);
    }
  }, [isArchivedModalOpen, props.projectId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [needs, running] = await Promise.all([
          getNeedsInput(),
          getRunningCards(),
        ]);
        setNeedsInputMap(needs);
        setRunningCardsMap((old) => {
          const hadRunning = Object.values(old).some(Boolean);
          const stillRunning = Object.values(running).some(Boolean);
          if (hadRunning && !stillRunning) loadCards();
          return running;
        });
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadCards]);

  useEffect(() => {
    if (!props.autoModeActive) return;
    const interval = setInterval(loadCards, 2000);
    return () => clearInterval(interval);
  }, [props.autoModeActive, loadCards]);

  useEffect(() => {
    if (!isGeneratingPlan || !props.projectId) return;
    const interval = setInterval(async () => {
      try {
        await loadCards();
        const { isGenerating } = await getPlanGenerationStatus(
          props.projectId!
        );
        if (!isGenerating) setIsGeneratingPlan(false);
      } catch {
        // ignore
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isGeneratingPlan, props.projectId, loadCards]);

  const getCardsForColumn = (columnId: string) =>
    cards
      .filter((c) => c.columnId === columnId)
      .map((c) => ({
        ...c,
        generatingTitle: generatingTitles.has(c.id),
        needsInput: needsInputMap[c.id] ?? false,
        isRunning: runningCardsMap[c.id] ?? false,
      }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string;
    const newColumnId = over.id as string;
    try {
      await updateCard(cardId, { columnId: newColumnId });
      loadCards();
      if (newColumnId === "in-progress") {
        try {
          await runCard({ cardId });
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      console.error(e);
      loadCards();
    }
  };

  const handleCreateCard = async (
    title: string,
    description: string,
    columnId: string
  ) => {
    if (!props.projectId) {
      alert("Please select a project first.");
      return;
    }
    try {
      const newCard = await createCard({
        title: title || undefined,
        description,
        columnId,
        projectId: props.projectId,
      });
      setIsModalOpen(false);
      loadCards();
      if ((!title || !title.trim()) && description && !newCard.title) {
        setGeneratingTitles((prev) => new Set(prev).add(newCard.id));
        try {
          await generateTitle(newCard.id);
          loadCards();
        } catch (e) {
          console.error(e);
        } finally {
          setGeneratingTitles((prev) => {
            const next = new Set(prev);
            next.delete(newCard.id);
            return next;
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to create card.");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await deleteCard(cardId);
      loadCards();
    } catch (e) {
      console.error(e);
      alert("Failed to delete card.");
    }
  };

  const handleArchiveCard = async (cardId: string) => {
    try {
      await archiveCard(cardId);
      loadCards();
    } catch (e) {
      console.error(e);
      alert("Failed to archive card.");
    }
  };

  const handleStopCard = async (cardId: string) => {
    try {
      await cancelRun(cardId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCardClick = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    props.onCardClick?.(
      cardId,
      card?.title ?? undefined,
      card?.description ?? undefined
    );
  };

  const handlePlanSubmit = (description: string): Promise<void> => {
    if (!props.projectId) return Promise.resolve();
    planGenerationCancelledRef.current = false;
    setIsGeneratingPlan(true);
    return generatePlan(props.projectId, description)
      .then(() => loadCards())
      .catch((e) => {
        console.error(e);
        if (
          !planGenerationCancelledRef.current &&
          !(e instanceof Error && e.name === "AbortError")
        ) {
          alert(e instanceof Error ? e.message : "Failed to generate plan.");
        }
      })
      .finally(() => setIsGeneratingPlan(false));
  };

  const handleStopPlanGeneration = async () => {
    if (!props.projectId) return;
    planGenerationCancelledRef.current = true;
    try {
      await cancelPlanGeneration(props.projectId);
      setIsGeneratingPlan(false);
      loadCards();
    } catch (e) {
      console.error(e);
    }
  };

  if (!props.projectId) {
    return (
      <div className="kanban-board">
        <div className="kanban-board__fallback">
          <p>Please select a project to view its Kanban board.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          <div className="kanban-board__columns">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                icon={COLUMN_ICONS[column.id]}
                cards={getCardsForColumn(column.id)}
                onDeleteCard={handleDeleteCard}
                onCreateCard={
                  column.id === "todo" ? () => setIsModalOpen(true) : undefined
                }
                onPlanWithAI={
                  column.id === "todo"
                    ? () => setIsPlanModalOpen(true)
                    : undefined
                }
                isGeneratingPlan={
                  column.id === "todo" ? isGeneratingPlan : undefined
                }
                onStopPlanGeneration={
                  column.id === "todo" ? handleStopPlanGeneration : undefined
                }
                onArchiveCard={handleArchiveCard}
                onStopCard={handleStopCard}
                onViewArchived={
                  column.id === "todo" || column.id === "done"
                    ? () => setIsArchivedModalOpen(true)
                    : undefined
                }
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        </div>
      </DndContext>
      <CreateCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCard}
      />
      <PlanGenerationModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSubmit={handlePlanSubmit}
      />
      <ArchivedCardsModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
        archivedCards={archivedCards}
      />
    </>
  );
}
