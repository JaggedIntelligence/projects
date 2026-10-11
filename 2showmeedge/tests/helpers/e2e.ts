import { expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

const configuredStorageState = process.env.E2E_STORAGE_STATE;

export const authStorageState =
  configuredStorageState && existsSync(configuredStorageState) ? configuredStorageState : undefined;

export const hasAuthStorageState = Boolean(authStorageState);

export function uniqueTaskTitle(prefix = "E2E task") {
  return `${prefix} ${Date.now()}`;
}

export async function openTasksPage(page: Page) {
  await page.goto("/tasks");
}

export async function createTask(page: Page, title: string, description = "Created by Playwright") {
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("heading", { name: "Create task" })).toBeVisible();

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Save task" }).click();

  await expect(page.getByText(title)).toBeVisible();
}

export async function editVisibleTaskTitle(page: Page, nextTitle: string) {
  await page.getByRole("button", { name: "Edit task" }).first().click();
  await expect(page.getByRole("heading", { name: "Edit task" })).toBeVisible();

  await page.getByLabel("Title").fill(nextTitle);
  await page.getByRole("button", { name: "Save task" }).click();

  await expect(page.getByText(nextTitle)).toBeVisible();
}

export async function deleteVisibleTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Delete task" }).first().click();
  await expect(page.getByText(title)).toBeHidden();
}
