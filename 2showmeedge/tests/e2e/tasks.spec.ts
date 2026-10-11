import { expect, test } from "@playwright/test";

import {
  authStorageState,
  createTask,
  deleteVisibleTask,
  editVisibleTaskTitle,
  hasAuthStorageState,
  openTasksPage,
  uniqueTaskTitle
} from "@/tests/helpers/e2e";

test.describe("tasks workflow", () => {
  test.skip(!hasAuthStorageState, "Set E2E_STORAGE_STATE to a saved Clerk session to run authenticated E2E tests.");
  test.use({ storageState: authStorageState });

  test("creates, edits, and deletes a task", async ({ page }) => {
    const title = uniqueTaskTitle();
    const updatedTitle = `${title} updated`;

    await openTasksPage(page);
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();

    await createTask(page, title);
    await editVisibleTaskTitle(page, updatedTitle);
    await deleteVisibleTask(page, updatedTitle);
  });
});
