import type { Context } from "hono";
import { cardLogRepository } from "@autoboard/db";
import { cardRunStateService } from "@autoboard/services";

export function createCardLogsController() {
  return {
    async getLogs(c: Context) {
      try {
        const url = new URL(c.req.url);
        const cardId = url.searchParams.get("cardId");
        if (!cardId) {
          return c.json({ error: "cardId is required" }, 400);
        }
        const logs = await cardLogRepository.getLogsByCardId(cardId);
        return c.json(logs);
      } catch (error) {
        console.error("Error fetching card logs:", error);
        return c.json({ error: "Failed to fetch card logs" }, 500);
      }
    },

    async getStream(c: Context) {
      const url = new URL(c.req.url);
      const cardId = url.searchParams.get("cardId");
      if (!cardId) {
        return c.json({ error: "cardId is required" }, 400);
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          function send(event: string, data: unknown) {
            try {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            } catch {
              // Stream may be closed
            }
          }

          const run = cardRunStateService.getRun(cardId);
          if (run) {
            send("status", {
              cardId,
              status: run.status,
              error: run.error,
              needsInput: run.needsInput,
            });
          } else {
            send("status", { cardId, status: "not_found" });
          }

          const unsubLog = cardRunStateService.onLog(cardId, (event) => {
            send("log", event);
          });
          const unsubStatus = cardRunStateService.onStatusChange(cardId, (event) => {
            send("status", event);
            if (event.status === "completed" || event.status === "error") {
              cleanup();
            }
          });
          const unsubNeedsInput = cardRunStateService.onNeedsInput(cardId, (event) => {
            send("needsInput", event);
          });

          function cleanup() {
            unsubLog();
            unsubStatus();
            unsubNeedsInput();
            try {
              controller.close();
            } catch {
              // Already closed
            }
          }

          c.req.raw.signal.addEventListener("abort", cleanup);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },

    async postInput(c: Context) {
      try {
        const body = await c.req.json();
        const { cardId, message } = body;
        if (!cardId || !message) {
          return c.json(
            { error: "cardId and message are required" },
            400
          );
        }
        const run = cardRunStateService.getRun(cardId);
        if (!run) {
          return c.json({ error: "No active run found" }, 404);
        }
        if (!run.query) {
          return c.json(
            { error: "No query reference available" },
            400
          );
        }
        run.query.streamInput(message);
        cardRunStateService.setNeedsInput(cardId, false);
        const seq = cardRunStateService.emitLog(cardId, "user_input", message);
        await cardLogRepository.createLog({
          cardId,
          type: "user_input",
          content: message,
          sequence: seq,
        });
        return c.json({ success: true });
      } catch (error) {
        console.error("Error sending card input:", error);
        return c.json({ error: "Failed to send input" }, 500);
      }
    },

    getNeedsInput(c: Context) {
      const result: Record<string, boolean> = {};
      for (const [cardId, run] of cardRunStateService.getAllRuns()) {
        if (run.needsInput) result[cardId] = true;
      }
      return c.json(result);
    },

    getRunningCards(c: Context) {
      const result: Record<string, boolean> = {};
      for (const [cardId, run] of cardRunStateService.getAllRuns()) {
        if (run.status === "running") result[cardId] = true;
      }
      return c.json(result);
    },
  };
}
