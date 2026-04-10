/**
 * Unit tests for the FileTree component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import FileTree from "../components/FileTree";
import type { ChapterInfo } from "../types";

const CHAPTERS: ChapterInfo[] = [
  { filename: "01-intro.txt", title: "Introduction", order: 1, char_count: 500 },
  { filename: "02-main.txt", title: "The Main Event", order: 2, char_count: 1000 },
  { filename: "03-end.txt", title: "The End", order: 3, char_count: 200 },
];

describe("FileTree", () => {
  it("renders the book id as the folder name", () => {
    render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("dracula")).toBeInTheDocument();
  });

  it("renders all chapter titles", () => {
    render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("The Main Event")).toBeInTheDocument();
    expect(screen.getByText("The End")).toBeInTheDocument();
  });

  it("renders no chapter items when chapters array is empty", () => {
    render(
      <FileTree
        bookId="empty-book"
        chapters={[]}
        activeChapter={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("listitem")).toBeNull();
    // Folder name still shows
    expect(screen.getByText("empty-book")).toBeInTheDocument();
  });

  it("applies 'active' class to the active chapter", () => {
    const { container } = render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter="01-intro.txt"
        onSelect={vi.fn()}
      />,
    );
    const activeItems = container.querySelectorAll(".file-tree-item.active");
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].textContent).toContain("Introduction");
  });

  it("does not apply 'active' class when no chapter is selected", () => {
    const { container } = render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter={null}
        onSelect={vi.fn()}
      />,
    );
    const activeItems = container.querySelectorAll(".file-tree-item.active");
    expect(activeItems).toHaveLength(0);
  });

  it("calls onSelect with the chapter filename when a chapter is clicked", () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("The Main Event"));
    expect(onSelect).toHaveBeenCalledWith("02-main.txt");
  });

  it("calls onSelect with correct filename for each chapter", () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("Introduction"));
    expect(onSelect).toHaveBeenLastCalledWith("01-intro.txt");

    fireEvent.click(screen.getByText("The End"));
    expect(onSelect).toHaveBeenLastCalledWith("03-end.txt");
  });

  it("updates active chapter when activeChapter prop changes", () => {
    const { container, rerender } = render(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter="01-intro.txt"
        onSelect={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".file-tree-item.active")).toHaveLength(1);

    rerender(
      <FileTree
        bookId="dracula"
        chapters={CHAPTERS}
        activeChapter="02-main.txt"
        onSelect={vi.fn()}
      />,
    );

    const activeItems = container.querySelectorAll(".file-tree-item.active");
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0].textContent).toContain("The Main Event");
  });
});
