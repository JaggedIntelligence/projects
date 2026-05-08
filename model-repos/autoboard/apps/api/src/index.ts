import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  cardRepository,
  projectRepository,
  autoModeSettingsRepository,
} from "@autoboard/db";
import { autoModeLoop } from "./auto-mode-loop.js";
import { createCardsController } from "./controllers/cards-controller.js";
import { createProjectsController } from "./controllers/projects-controller.js";
import { createRunCardController } from "./controllers/run-card-controller.js";
import { createCardLogsController } from "./controllers/card-logs-controller.js";
import { createAutoModeController } from "./controllers/auto-mode-controller.js";
import { createGenerateTitleController } from "./controllers/generate-title-controller.js";
import { createPlanGenerationController } from "./controllers/plan-generation-controller.js";

const app = new Hono();

const cards = createCardsController(cardRepository);
const projects = createProjectsController(
  projectRepository,
  autoModeSettingsRepository,
  autoModeLoop
);
const runCard = createRunCardController(cardRepository, projectRepository);
const cardLogs = createCardLogsController();
const autoMode = createAutoModeController(
  autoModeSettingsRepository,
  autoModeLoop
);
const generateTitle = createGenerateTitleController(
  cardRepository,
  projectRepository
);
const planGeneration = createPlanGenerationController(
  cardRepository,
  projectRepository
);

const api = new Hono();

api.get("/cards", cards.get);
api.post("/cards", cards.post);
api.patch("/cards", cards.patch);
api.delete("/cards", cards.delete);

api.get("/projects", projects.get);
api.post("/projects", projects.post);
api.patch("/projects", projects.patch);
api.delete("/projects", projects.delete);

api.post("/run-card", runCard.post);
api.get("/run-card", runCard.get);
api.delete("/run-card", runCard.delete);

api.get("/card-logs", cardLogs.getLogs);
api.get("/card-logs-stream", cardLogs.getStream);
api.post("/card-input", cardLogs.postInput);
api.get("/needs-input", cardLogs.getNeedsInput);
api.get("/running-cards", cardLogs.getRunningCards);

api.get("/auto-mode", autoMode.get);
api.post("/auto-mode", autoMode.post);
api.patch("/auto-mode", autoMode.patch);

api.post("/generate-title", generateTitle.post);
api.post("/plan-generation", planGeneration.post);
api.get("/plan-generation/status", planGeneration.get);
api.delete("/plan-generation", planGeneration.delete);

app.route("/api", api);

const port = Number(process.env.PORT) || 3001;

async function main() {
  await autoModeLoop.ensureInitialized();
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`API server running at http://localhost:${info.port}/api`);
    }
  );
}

main();
