import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  selectedCardIdAtom,
  selectedCardTitleAtom,
  selectedCardDescriptionAtom,
  drawerKeyAtom,
  closeDrawer,
  sendFollowUp,
  handleRunComplete,
} from "~/atoms/log-drawer";
import {
  getCardLogs,
  subscribeToCardLogs,
  sendCardInput,
} from "~/api/card-logs";
import { cancelRun } from "~/api/run-card";

const LOG_TYPE_STYLES: Record<string, { label: string; borderColor: string }> = {
  assistant_text: { label: "Assistant", borderColor: "#4a9eff" },
  tool_use: { label: "Tool Call", borderColor: "#a855f7" },
  tool_result: { label: "Tool Result", borderColor: "#22c55e" },
  error: { label: "Error", borderColor: "#ef4444" },
  user_input: { label: "User", borderColor: "#f97316" },
  system: { label: "System", borderColor: "#6b7280" },
  ask_user: { label: "Needs Input", borderColor: "#f97316" },
};

interface LogEntry {
  type: string;
  content: string;
  sequence: number;
}

export default function LogDrawer() {
  const cardId = useAtomValue(selectedCardIdAtom);
  const cardTitle = useAtomValue(selectedCardTitleAtom);
  const cardDescription = useAtomValue(selectedCardDescriptionAtom);
  const reconnectKey = useAtomValue(drawerKeyAtom);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState("not_found");
  const [needsInput, setNeedsInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasSeenRunningRef = useRef(false);

  const scrollToBottom = () => {
    contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight });
  };

  useEffect(() => {
    if (!cardId) {
      setLogs([]);
      setStatus("not_found");
      setNeedsInput(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    hasSeenRunningRef.current = false;
    eventSourceRef.current?.close();
    setStatus("running");
    setNeedsInput(false);

    getCardLogs(cardId).then((historicalLogs) => {
      setLogs(
        historicalLogs.map((l) => ({
          type: l.type,
          content: l.content,
          sequence: l.sequence,
        }))
      );
      setTimeout(scrollToBottom, 50);
    }).catch(console.error);

    const es = subscribeToCardLogs(cardId, {
      onLog(event) {
        setLogs((prev) => {
          if (prev.some((l) => l.sequence === event.sequence)) return prev;
          return [...prev, { type: event.type, content: event.content, sequence: event.sequence }];
        });
        setTimeout(scrollToBottom, 50);
      },
      onStatus(event) {
        if (event.status === "running") hasSeenRunningRef.current = true;
        setStatus(event.status);
        if (event.needsInput !== undefined) setNeedsInput(event.needsInput);
        if (
          (event.status === "completed" || event.status === "error") &&
          hasSeenRunningRef.current
        ) {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          handleRunComplete();
        }
      },
      onNeedsInput(event) {
        setNeedsInput(event.needsInput);
      },
    });
    eventSourceRef.current = es;
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [cardId, reconnectKey]);

  const isRunning = status === "running";
  const isFinished = status === "completed" || status === "error" || status === "not_found";
  const canSendInput = (isRunning && needsInput) || isFinished;

  const handleSend = async () => {
    if (!cardId || !inputText.trim()) return;
    if (isRunning && needsInput) {
      try {
        await sendCardInput(cardId, inputText.trim());
        setInputText("");
      } catch (e) {
        console.error(e);
      }
    } else if (isFinished) {
      sendFollowUp(cardId, inputText.trim());
      setInputText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "running": return "#22c55e";
      case "completed": return "#4a9eff";
      case "not_found": return "#4a9eff";
      case "error": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getStatusLabel = () => (status === "not_found" ? "idle" : status);

  const formatContent = (type: string, content: string): string => {
    if (type === "tool_use") {
      try {
        const parsed = JSON.parse(content);
        return `Tool: ${parsed.tool}`;
      } catch {
        return content;
      }
    }
    if (type === "ask_user") {
      try {
        const parsed = JSON.parse(content);
        if (parsed.questions) return parsed.questions.map((q: { question: string }) => q.question).join("\n");
        return content;
      } catch {
        return content;
      }
    }
    return content.length > 500 ? content.slice(0, 500) + "..." : content;
  };

  const getInputPlaceholder = () => {
    if (isRunning && needsInput) return "Type your response to the agent...";
    if (isFinished) return "Type a follow-up prompt...";
    return "Waiting for agent...";
  };

  const handleStop = async () => {
    if (!cardId) return;
    try {
      await cancelRun(cardId);
    } catch (e) {
      console.error(e);
    }
  };

  if (!cardId) return null;

  return (
    <>
      <div className="log-drawer-backdrop" onClick={closeDrawer} />
      <div className="log-drawer">
        <div className="log-drawer__header">
          <div className="log-drawer__header-left">
            <span
              className="log-drawer__status-dot"
              style={{ backgroundColor: getStatusColor() }}
            />
            <h3 className="log-drawer__title">Agent Logs</h3>
            <span className="log-drawer__status-text">{getStatusLabel()}</span>
          </div>
          <button className="log-drawer__close" onClick={closeDrawer}>
            ×
          </button>
        </div>

        {(cardTitle || cardDescription) && (
          <div className="log-drawer__card-details">
            <button
              className="log-drawer__card-details-toggle"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <svg
                className={`log-drawer__card-details-chevron ${detailsOpen ? "log-drawer__card-details-chevron--open" : ""}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="log-drawer__card-details-label">Card Details</span>
            </button>
            {detailsOpen && (
              <div className="log-drawer__card-details-body">
                {cardTitle && <div className="log-drawer__card-detail-title">{cardTitle}</div>}
                {cardDescription && (
                  <div className="log-drawer__card-detail-description">{cardDescription}</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="log-drawer__content" ref={contentRef}>
          {logs.length === 0 ? (
            <div className="log-drawer__empty">
              <p>No logs yet.</p>
              {isRunning && <p>Waiting for agent output...</p>}
            </div>
          ) : (
            logs.map((log) => {
              const style = LOG_TYPE_STYLES[log.type] ?? LOG_TYPE_STYLES.system;
              return (
                <div
                  key={log.sequence}
                  className={`log-entry ${log.type === "ask_user" ? "log-entry--ask-user" : ""}`}
                  style={{ borderLeftColor: style.borderColor }}
                >
                  <div className="log-entry__header">
                    <span className="log-entry__type" style={{ color: style.borderColor }}>
                      {style.label}
                    </span>
                    <span className="log-entry__seq">#{log.sequence}</span>
                  </div>
                  <div className="log-entry__content">
                    {formatContent(log.type, log.content)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="log-drawer__footer">
          {isRunning && (
            <div className="log-drawer__running-row">
              {!needsInput && (
                <div className="log-drawer__running-indicator">
                  <span className="log-drawer__spinner" />
                  <span>Agent is working...</span>
                </div>
              )}
              <button
                type="button"
                className="log-drawer__stop"
                onClick={handleStop}
                aria-label="Stop agent"
                title="Stop agent"
              >
                Stop
              </button>
            </div>
          )}
          <div className="log-drawer__input-row">
            <input
              type="text"
              className="log-drawer__input"
              placeholder={getInputPlaceholder()}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!canSendInput}
            />
            <button
              className="log-drawer__send"
              onClick={handleSend}
              disabled={!canSendInput || !inputText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
