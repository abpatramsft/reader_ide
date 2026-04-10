/**
 * E2E tests for the Library landing page (/).
 *
 * All /api/* requests are intercepted so that no real backend is needed.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const MOCK_BOOK = {
  book_id: "dracula",
  title: "Dracula",
  authors: ["Bram Stoker"],
  language: "en",
  description: "A gothic horror novel.",
  publisher: null,
  date: "1897",
  subjects: ["Horror"],
  chapters: [
    { filename: "01-intro.txt", title: "Introduction", order: 1, char_count: 500 },
    { filename: "02-chapter-i.txt", title: "Chapter I", order: 2, char_count: 4000 },
  ],
  processed_at: "2024-01-01T00:00:00",
};

async function mockApiEmpty(page: Page) {
  await page.route("/api/auth/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false, has_token: false }),
    }),
  );
  await page.route("/api/books", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

async function mockApiWithBook(page: Page) {
  await page.route("/api/auth/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, has_token: true }),
    }),
  );
  await page.route("/api/books", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_BOOK]),
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests — empty library
// ---------------------------------------------------------------------------

test.describe("Library page — empty library", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiEmpty(page);
    await page.goto("/");
  });

  test("displays the app title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Reader IDE" })).toBeVisible();
  });

  test("shows the subtitle text", async ({ page }) => {
    await expect(
      page.getByText(/Your personal book library/i),
    ).toBeVisible();
  });

  test("shows the upload zone", async ({ page }) => {
    await expect(
      page.getByText(/Drop an EPUB file here/i),
    ).toBeVisible();
  });

  test("shows empty-state message when no books", async ({ page }) => {
    await expect(
      page.getByText(/No books yet/i),
    ).toBeVisible();
  });

  test("shows GitHub token prompt when unauthenticated", async ({ page }) => {
    await expect(
      page.getByText(/GitHub Personal Access Token/i),
    ).toBeVisible();
  });

  test("shows Connect button when unauthenticated", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Connect/i })).toBeVisible();
  });

  test("Connect button is disabled when token input is empty", async ({
    page,
  }) => {
    const connectBtn = page.getByRole("button", { name: /Connect/i });
    await expect(connectBtn).toBeDisabled();
  });

  test("Connect button is enabled when token is typed", async ({ page }) => {
    await page.getByPlaceholder(/ghp_/i).fill("ghp_testtoken123");
    await expect(
      page.getByRole("button", { name: /Connect/i }),
    ).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Tests — library with books
// ---------------------------------------------------------------------------

test.describe("Library page — with books", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiWithBook(page);
    await page.goto("/");
  });

  test("shows Copilot connected status", async ({ page }) => {
    await expect(page.getByText(/Copilot connected/i)).toBeVisible();
  });

  test("shows book card with title", async ({ page }) => {
    await expect(page.getByText("Dracula")).toBeVisible();
  });

  test("shows book author on the card", async ({ page }) => {
    await expect(page.getByText("Bram Stoker")).toBeVisible();
  });

  test("shows chapter count on the card", async ({ page }) => {
    await expect(page.getByText(/2 chapters/i)).toBeVisible();
  });

  test("clicking a book card navigates to the reader", async ({ page }) => {
    // Also intercept the reader page API calls so navigation succeeds
    await page.route("/api/books/dracula", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BOOK),
      }),
    );

    await page.getByText("Dracula").click();
    await expect(page).toHaveURL(/\/read\/dracula/);
  });
});

// ---------------------------------------------------------------------------
// Tests — upload interaction
// ---------------------------------------------------------------------------

test.describe("Library page — upload interaction", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiEmpty(page);
    await page.goto("/");
  });

  test("upload zone is clickable", async ({ page }) => {
    // The hidden file input should be present in the DOM
    const fileInput = page.locator("#epub-input");
    await expect(fileInput).toBeAttached();
  });

  test("shows error when non-epub is uploaded via mock", async ({ page }) => {
    await page.route("/api/upload", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Only .epub files are accepted" }),
      }),
    );

    // Simulate a file input change with a fake .txt file
    await page.evaluate(() => {
      const input = document.getElementById("epub-input") as HTMLInputElement;
      const file = new File(["data"], "bad.txt", { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(
      page.getByText(/Only .epub files are accepted/i),
    ).toBeVisible();
  });
});
