/**
 * Unit tests for the TextViewer component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import TextViewer from "../components/TextViewer";
import * as api from "../api";
import type { ChapterInfo } from "../types";

const CHAPTERS: ChapterInfo[] = [
  { filename: "01-intro.txt", title: "Introduction", order: 1, char_count: 300 },
  { filename: "02-main.txt", title: "The Main Event", order: 2, char_count: 800 },
];

describe("TextViewer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("shows empty-state message when no chapter is selected", () => {
    render(
      <TextViewer bookId="dracula" chapterFile={null} chapters={CHAPTERS} />,
    );
    expect(
      screen.getByText(/select a chapter/i),
    ).toBeInTheDocument();
  });

  it("does not show a tab bar when no chapter is selected", () => {
    const { container } = render(
      <TextViewer bookId="dracula" chapterFile={null} chapters={CHAPTERS} />,
    );
    expect(container.querySelector(".text-viewer-tabs")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it("shows loading indicator while fetching chapter text", async () => {
    vi.spyOn(api, "fetchChapterText").mockReturnValue(new Promise(() => {}));
    render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );
    expect(screen.getByText(/loading chapter/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Successful fetch
  // -------------------------------------------------------------------------

  it("renders chapter title in the tab bar after loading", async () => {
    vi.spyOn(api, "fetchChapterText").mockResolvedValue(
      "The count had a strange look about him.",
    );
    render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Introduction")).toBeInTheDocument();
    });
  });

  it("renders chapter content paragraphs after loading", async () => {
    vi.spyOn(api, "fetchChapterText").mockResolvedValue(
      "First paragraph text.  Second paragraph text.",
    );
    render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("First paragraph text.")).toBeInTheDocument();
    });
  });

  it("shows breadcrumb with book id and chapter filename", async () => {
    vi.spyOn(api, "fetchChapterText").mockResolvedValue("Some text here.");
    render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("dracula")).toBeInTheDocument();
      expect(screen.getByText("01-intro.txt")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it("shows failure message when fetch rejects", async () => {
    vi.spyOn(api, "fetchChapterText").mockRejectedValue(
      new Error("Chapter not found"),
    );
    render(
      <TextViewer
        bookId="dracula"
        chapterFile="99-missing.txt"
        chapters={CHAPTERS}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/failed to load chapter/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Chapter switching
  // -------------------------------------------------------------------------

  it("re-fetches content when chapterFile prop changes", async () => {
    const spy = vi
      .spyOn(api, "fetchChapterText")
      .mockResolvedValueOnce("First chapter content.")
      .mockResolvedValueOnce("Second chapter content.");

    const { rerender } = render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("First chapter content.")).toBeInTheDocument(),
    );

    rerender(
      <TextViewer
        bookId="dracula"
        chapterFile="02-main.txt"
        chapters={CHAPTERS}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Second chapter content.")).toBeInTheDocument(),
    );

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("clears content when chapterFile switches to null", async () => {
    vi.spyOn(api, "fetchChapterText").mockResolvedValue("Some chapter text.");
    const { rerender } = render(
      <TextViewer
        bookId="dracula"
        chapterFile="01-intro.txt"
        chapters={CHAPTERS}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Some chapter text.")).toBeInTheDocument(),
    );

    rerender(
      <TextViewer bookId="dracula" chapterFile={null} chapters={CHAPTERS} />,
    );

    expect(screen.getByText(/select a chapter/i)).toBeInTheDocument();
    expect(screen.queryByText("Some chapter text.")).toBeNull();
  });
});
