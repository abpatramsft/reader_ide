/**
 * Unit tests for the API client (src/api.ts).
 * All network calls are intercepted by mocking the global `fetch`.
 */

import {
  deleteBook,
  fetchAuthStatus,
  fetchBook,
  fetchBooks,
  fetchChapterText,
  fetchNoteContent,
  fetchNotes,
  logout,
  streamChat,
  submitToken,
  uploadEpub,
  deleteNoteApi,
} from "../api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    body: null,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchAuthStatus
// ---------------------------------------------------------------------------

describe("fetchAuthStatus", () => {
  it("returns authenticated and has_token flags", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(200, { authenticated: false, has_token: false }),
    );
    const result = await fetchAuthStatus();
    expect(result.authenticated).toBe(false);
    expect(result.has_token).toBe(false);
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal("fetch", makeFetchMock(500, {}));
    await expect(fetchAuthStatus()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// submitToken
// ---------------------------------------------------------------------------

describe("submitToken", () => {
  it("returns status and authenticated on success", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(200, { status: "ok", authenticated: true }),
    );
    const result = await submitToken("ghp_abc123");
    expect(result.authenticated).toBe(true);
  });

  it("throws with detail message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(400, { detail: "Token cannot be empty" }),
    );
    await expect(submitToken("")).rejects.toThrow("Token cannot be empty");
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe("logout", () => {
  it("resolves without error on success", async () => {
    vi.stubGlobal("fetch", makeFetchMock(200, {}));
    await expect(logout()).resolves.toBeUndefined();
  });

  it("throws when logout request fails", async () => {
    vi.stubGlobal("fetch", makeFetchMock(500, {}));
    await expect(logout()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchBooks
// ---------------------------------------------------------------------------

describe("fetchBooks", () => {
  it("returns an array of books", async () => {
    const books = [{ book_id: "dracula", title: "Dracula", authors: [], chapters: [] }];
    vi.stubGlobal("fetch", makeFetchMock(200, books));
    const result = await fetchBooks();
    expect(result).toHaveLength(1);
    expect(result[0].book_id).toBe("dracula");
  });

  it("throws on network error", async () => {
    vi.stubGlobal("fetch", makeFetchMock(500, {}));
    await expect(fetchBooks()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchBook
// ---------------------------------------------------------------------------

describe("fetchBook", () => {
  it("returns book metadata", async () => {
    const book = { book_id: "dracula", title: "Dracula", authors: ["Stoker"] };
    vi.stubGlobal("fetch", makeFetchMock(200, book));
    const result = await fetchBook("dracula");
    expect(result.title).toBe("Dracula");
  });

  it("throws when book is not found", async () => {
    vi.stubGlobal("fetch", makeFetchMock(404, { detail: "Not found" }));
    await expect(fetchBook("ghost")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// uploadEpub
// ---------------------------------------------------------------------------

describe("uploadEpub", () => {
  it("posts form data and returns book metadata", async () => {
    const book = { book_id: "frankenstein", title: "Frankenstein" };
    vi.stubGlobal("fetch", makeFetchMock(200, book));
    const file = new File(["epub content"], "frankenstein.epub", {
      type: "application/epub+zip",
    });
    const result = await uploadEpub(file);
    expect(result.title).toBe("Frankenstein");
  });

  it("throws with server detail on failure", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(400, { detail: "Only .epub files are accepted" }),
    );
    const file = new File(["not epub"], "bad.txt", { type: "text/plain" });
    await expect(uploadEpub(file)).rejects.toThrow(
      "Only .epub files are accepted",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteBook
// ---------------------------------------------------------------------------

describe("deleteBook", () => {
  it("resolves without error on success", async () => {
    vi.stubGlobal("fetch", makeFetchMock(200, { status: "deleted" }));
    await expect(deleteBook("dracula")).resolves.toBeUndefined();
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal("fetch", makeFetchMock(404, { detail: "Not found" }));
    await expect(deleteBook("missing")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchChapterText
// ---------------------------------------------------------------------------

describe("fetchChapterText", () => {
  it("returns chapter content string", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(200, { filename: "01-intro.txt", content: "Chapter text." }),
    );
    const text = await fetchChapterText("dracula", "01-intro.txt");
    expect(text).toBe("Chapter text.");
  });

  it("throws when chapter is not found", async () => {
    vi.stubGlobal("fetch", makeFetchMock(404, { detail: "Not found" }));
    await expect(fetchChapterText("dracula", "99-missing.txt")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchNotes / fetchNoteContent / deleteNoteApi
// ---------------------------------------------------------------------------

describe("fetchNotes", () => {
  it("returns an array of note info objects", async () => {
    const notes = [{ filename: "note1.txt", title: "Note 1", size: 100, modified: 0 }];
    vi.stubGlobal("fetch", makeFetchMock(200, notes));
    const result = await fetchNotes("dracula");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("note1.txt");
  });
});

describe("fetchNoteContent", () => {
  it("returns note content", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock(200, { filename: "note1.txt", content: "My note." }),
    );
    const content = await fetchNoteContent("dracula", "note1.txt");
    expect(content).toBe("My note.");
  });
});

describe("deleteNoteApi", () => {
  it("resolves without error on success", async () => {
    vi.stubGlobal("fetch", makeFetchMock(200, { status: "deleted" }));
    await expect(deleteNoteApi("dracula", "note1.txt")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// streamChat — SSE streaming
// ---------------------------------------------------------------------------

describe("streamChat", () => {
  function makeStreamResponse(sseLines: string[]) {
    const body = sseLines.join("\n") + "\n";
    const encoder = new TextEncoder();
    const encoded = encoder.encode(body);
    let called = false;
    return {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockImplementation(() => {
            if (!called) {
              called = true;
              return Promise.resolve({ done: false, value: encoded });
            }
            return Promise.resolve({ done: true, value: undefined });
          }),
        }),
      },
    };
  }

  it("calls onDelta with delta content", async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeStreamResponse([
          'data: {"type":"delta","content":"Hello"}',
          "data: [DONE]",
        ]),
      ),
    );

    await streamChat("book1", "Hi", null, onDelta, onDone, onError);
    expect(onDelta).toHaveBeenCalledWith("Hello");
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError when server returns an error event", async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeStreamResponse([
          'data: {"type":"error","message":"Something went wrong"}',
          "data: [DONE]",
        ]),
      ),
    );

    await streamChat("book1", "Hi", null, onDelta, onDone, onError);
    expect(onError).toHaveBeenCalledWith("Something went wrong");
  });

  it("calls onError when fetch response is not ok", async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ detail: "Book not found" }),
        body: null,
      }),
    );

    await streamChat("book1", "Hi", null, vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith("Book not found");
  });

  it("calls onToolEvent with tool_start events", async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    const onToolEvent = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeStreamResponse([
          'data: {"type":"tool_start","tool_name":"list_chapters","arguments":"{}"}',
          "data: [DONE]",
        ]),
      ),
    );

    await streamChat(
      "book1",
      "List chapters",
      null,
      onDelta,
      onDone,
      onError,
      onToolEvent,
    );
    expect(onToolEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tool_start", tool_name: "list_chapters" }),
    );
  });
});
