/**
 * E2E tests for the Reader page (/read/:bookId).
 *
 * All /api/* requests are intercepted so that no real backend is needed.
 * Note: Reader.tsx auto-selects the first chapter on load, so the text viewer
 * will contain chapter content as soon as the page loads.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_BOOK = {
  book_id: "moby-dick",
  title: "Moby-Dick",
  authors: ["Herman Melville"],
  language: "en",
  description: "The whale.",
  publisher: null,
  date: "1851",
  subjects: ["Adventure"],
  chapters: [
    {
      filename: "01-etymology.txt",
      title: "Etymology",
      order: 1,
      char_count: 300,
    },
    {
      filename: "02-chapter-i.txt",
      title: "Chapter I — Loomings",
      order: 2,
      char_count: 5000,
    },
    {
      filename: "03-chapter-ii.txt",
      title: "Chapter II — The Carpet-Bag",
      order: 3,
      char_count: 4500,
    },
  ],
  processed_at: "2024-01-01T00:00:00",
};

const CHAPTER_TEXT =
  "Call me Ishmael. Some years ago—never mind how long precisely—having little money in my purse, " +
  "and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.";

async function setupReaderMocks(page: Page) {
  await page.route("/api/auth/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, has_token: true }),
    }),
  );
  await page.route("/api/books/moby-dick", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_BOOK),
    }),
  );
  // Match any chapter request — return the same content for simplicity
  await page.route("/api/books/moby-dick/chapters/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filename: "01-etymology.txt",
        content: CHAPTER_TEXT,
      }),
    }),
  );
  await page.route("/api/skills", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          name: "recap",
          display_name: "Recap",
          description: "Recap the story so far.",
          icon: "Rewind",
          placeholder: "Recap...",
        },
      ]),
    }),
  );
  await page.route("/api/agents", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          name: "critic",
          display_name: "The Critic",
          description: "Literary critic persona.",
          icon: "BookUser",
          placeholder: "Ask the critic...",
        },
      ]),
    }),
  );
  await page.route("/api/books/moby-dick/notes", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests — layout and structure
// ---------------------------------------------------------------------------

test.describe("Reader page — layout", () => {
  test.beforeEach(async ({ page }) => {
    await setupReaderMocks(page);
    await page.goto("/read/moby-dick");
  });

  test("shows the book id in the file tree", async ({ page }) => {
    await expect(page.getByText("moby-dick")).toBeVisible();
  });

  test("shows the book title in the title bar", async ({ page }) => {
    await expect(page.getByText(/Moby-Dick/)).toBeVisible();
  });

  test("lists all chapter titles in the file explorer", async ({ page }) => {
    await expect(page.getByText("Etymology")).toBeVisible();
    await expect(page.getByText("Chapter I — Loomings")).toBeVisible();
    await expect(page.getByText("Chapter II — The Carpet-Bag")).toBeVisible();
  });

  test("auto-loads first chapter on page load", async ({ page }) => {
    // Reader.tsx auto-selects chapters[0] when the book loads
    await expect(page.getByText(/Call me Ishmael/i)).toBeVisible();
  });

  test("shows chapter count in the status bar", async ({ page }) => {
    await expect(page.getByText(/3 chapters/i)).toBeVisible();
  });

  test("back button is present", async ({ page }) => {
    // The titlebar has an ArrowLeft back button
    const backBtn = page.locator(".titlebar-back");
    await expect(backBtn).toBeVisible();
  });

  test("back button navigates to library", async ({ page }) => {
    // Mock the library routes
    await page.route("/api/books", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
    await page.locator(".titlebar-back").click();
    await expect(page).toHaveURL("/");
  });
});

// ---------------------------------------------------------------------------
// Tests — chapter navigation
// ---------------------------------------------------------------------------

test.describe("Reader page — chapter navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupReaderMocks(page);
    await page.goto("/read/moby-dick");
  });

  test("clicking a chapter loads its content in the viewer", async ({
    page,
  }) => {
    // Click the second chapter (first is auto-selected on load)
    await page.getByText("Chapter I — Loomings").click();
    await expect(page.getByText(/Call me Ishmael/i)).toBeVisible();
  });

  test("active chapter is highlighted in the file tree", async ({ page }) => {
    // First chapter is auto-selected
    const activeItem = page.locator(".file-tree-item.active");
    await expect(activeItem).toBeVisible();
  });

  test("clicking a chapter updates the active highlight", async ({ page }) => {
    await page.getByText("Chapter II — The Carpet-Bag").click();
    const activeItem = page.locator(".file-tree-item.active");
    await expect(activeItem).toContainText("Chapter II — The Carpet-Bag");
  });

  test("breadcrumb shows the chapter filename", async ({ page }) => {
    // After auto-load the breadcrumb should show the first chapter filename
    const breadcrumb = page.locator(".text-viewer-breadcrumb");
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText("moby-dick")).toBeVisible();
  });

  test("tab bar shows the chapter title", async ({ page }) => {
    await page.getByText("Chapter I — Loomings").click();
    const tabs = page.locator(".text-viewer-tabs");
    await expect(tabs).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tests — chat panel
// ---------------------------------------------------------------------------

test.describe("Reader page — chat panel", () => {
  test.beforeEach(async ({ page }) => {
    await setupReaderMocks(page);
    await page.goto("/read/moby-dick");
  });

  test("Copilot chat panel is visible", async ({ page }) => {
    await expect(page.locator(".copilot-chat")).toBeVisible();
  });

  test("chat textarea is present", async ({ page }) => {
    await expect(page.locator("textarea.chat-input")).toBeVisible();
  });

  test("chat input accepts text", async ({ page }) => {
    await page.locator("textarea.chat-input").fill("What is the theme?");
    await expect(page.locator("textarea.chat-input")).toHaveValue(
      "What is the theme?",
    );
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await expect(page.locator("button.chat-send")).toBeDisabled();
  });

  test("send button is enabled when input has text", async ({ page }) => {
    await page.locator("textarea.chat-input").fill("Hello");
    await expect(page.locator("button.chat-send")).toBeEnabled();
  });

  test("welcome message is shown before any chat", async ({ page }) => {
    await expect(page.locator(".chat-welcome")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tests — unknown book
// ---------------------------------------------------------------------------

test.describe("Reader page — unknown book", () => {
  test("shows error message when book is not found", async ({ page }) => {
    await page.route("/api/books/ghost-book", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Book not found" }),
      }),
    );

    await page.goto("/read/ghost-book");

    // Reader.tsx sets error = "Book not found" and renders a reader-error div
    await expect(page.locator(".reader-error")).toBeVisible();
    await expect(page.getByText(/Book not found/i)).toBeVisible();
  });

  test("error page has a back-to-library button", async ({ page }) => {
    await page.route("/api/books/ghost-book", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Book not found" }),
      }),
    );

    await page.goto("/read/ghost-book");

    await page.route("/api/books", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    const backBtn = page.getByRole("button", { name: /Back to Library/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL("/");
  });
});
