import { expect, test } from "@playwright/test";

test.describe("auth routing", () => {
  test("redirects unauthenticated users away from protected pages", async ({ page }) => {
    await page.goto("/tasks");

    await expect(page).toHaveURL(/\/sign-in|\/sign-up|clerk|accounts/);
  });
});
