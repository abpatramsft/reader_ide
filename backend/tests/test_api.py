"""
Integration tests for the FastAPI routes in main.py.

Uses FastAPI's TestClient (synchronous httpx wrapper) with patched DATA_DIR
so tests work against a temporary directory instead of the real data store.
The Copilot SDK is already mocked in conftest.py.
"""
import json
import os

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

# conftest.py already set up sys.path and SDK mocks before this import.
from main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client(tmp_path):
    """TestClient with an empty temporary data directory."""
    with patch("main.DATA_DIR", str(tmp_path)):
        with TestClient(app) as c:
            yield c


@pytest.fixture
def client_with_book(tmp_path):
    """TestClient with one sample book already in the data directory."""
    book_id = "test-book"
    book_dir = os.path.join(str(tmp_path), book_id)
    os.makedirs(book_dir)

    meta = {
        "book_id": book_id,
        "title": "Test Book",
        "authors": ["Test Author"],
        "language": "en",
        "description": None,
        "publisher": None,
        "date": None,
        "subjects": [],
        "chapters": [
            {
                "filename": "01-chapter-one.txt",
                "title": "Chapter One",
                "order": 1,
                "char_count": 200,
            }
        ],
        "processed_at": "2024-01-01T00:00:00",
    }
    with open(os.path.join(book_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
    with open(
        os.path.join(book_dir, "01-chapter-one.txt"), "w", encoding="utf-8"
    ) as f:
        f.write("Chapter one content. " * 15)

    with patch("main.DATA_DIR", str(tmp_path)):
        with TestClient(app) as c:
            yield c, book_id


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class TestHealthCheck:
    def test_root_returns_ok(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Reader IDE API"


# ---------------------------------------------------------------------------
# Authentication endpoints
# ---------------------------------------------------------------------------


class TestAuthEndpoints:
    def test_auth_status_shape(self, client):
        response = client.get("/api/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert "authenticated" in data
        assert "has_token" in data

    def test_auth_status_unauthenticated_by_default(self, client):
        response = client.get("/api/auth/status")
        data = response.json()
        # No token set → not authenticated
        assert data["authenticated"] is False

    def test_set_empty_token_returns_400(self, client):
        response = client.post("/api/auth/token", json={"token": ""})
        assert response.status_code == 400

    def test_set_whitespace_token_returns_400(self, client):
        response = client.post("/api/auth/token", json={"token": "   "})
        assert response.status_code == 400

    def test_logout_returns_ok(self, client):
        response = client.post("/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["authenticated"] is False


# ---------------------------------------------------------------------------
# Skills & Agents endpoints
# ---------------------------------------------------------------------------


class TestSkillsEndpoint:
    def test_returns_list(self, client):
        response = client.get("/api/skills")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_skills_have_required_fields(self, client):
        skills = client.get("/api/skills").json()
        for skill in skills:
            assert "name" in skill
            assert "display_name" in skill
            assert "description" in skill
            assert "icon" in skill

    def test_at_least_one_skill_loaded(self, client):
        skills = client.get("/api/skills").json()
        assert len(skills) > 0


class TestAgentsEndpoint:
    def test_returns_list(self, client):
        response = client.get("/api/agents")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_agents_have_required_fields(self, client):
        agents = client.get("/api/agents").json()
        for agent in agents:
            assert "name" in agent
            assert "display_name" in agent

    def test_at_least_one_agent_loaded(self, client):
        agents = client.get("/api/agents").json()
        assert len(agents) > 0


# ---------------------------------------------------------------------------
# Book library endpoints (empty library)
# ---------------------------------------------------------------------------


class TestBooksEmptyLibrary:
    def test_list_books_empty(self, client):
        response = client.get("/api/books")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_nonexistent_book_returns_404(self, client):
        assert client.get("/api/books/no-such-book").status_code == 404

    def test_delete_nonexistent_book_returns_404(self, client):
        assert client.delete("/api/books/no-such-book").status_code == 404

    def test_get_chapters_nonexistent_book_returns_404(self, client):
        assert client.get("/api/books/no-such-book/chapters").status_code == 404

    def test_upload_non_epub_returns_400(self, client, tmp_path):
        fake = tmp_path / "not_epub.txt"
        fake.write_text("definitely not an epub")
        with open(fake, "rb") as f:
            response = client.post(
                "/api/upload",
                files={"file": ("not_epub.txt", f, "text/plain")},
            )
        assert response.status_code == 400
        assert "epub" in response.json()["detail"].lower()

    def test_upload_missing_filename_returns_400(self, client, tmp_path):
        fake = tmp_path / "file.txt"
        fake.write_text("data")
        with open(fake, "rb") as f:
            response = client.post(
                "/api/upload",
                files={"file": ("file.txt", f, "text/plain")},
            )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Book library endpoints (library with one book)
# ---------------------------------------------------------------------------


class TestBooksWithData:
    def test_list_books_returns_book(self, client_with_book):
        client, book_id = client_with_book
        books = client.get("/api/books").json()
        assert any(b["book_id"] == book_id for b in books)

    def test_get_book_returns_metadata(self, client_with_book):
        client, book_id = client_with_book
        response = client.get(f"/api/books/{book_id}")
        assert response.status_code == 200
        assert response.json()["book_id"] == book_id
        assert response.json()["title"] == "Test Book"

    def test_get_chapters_returns_list(self, client_with_book):
        client, book_id = client_with_book
        chapters = client.get(f"/api/books/{book_id}/chapters").json()
        assert isinstance(chapters, list)
        assert len(chapters) == 1
        assert chapters[0]["filename"] == "01-chapter-one.txt"

    def test_get_chapter_text_returns_content(self, client_with_book):
        client, book_id = client_with_book
        response = client.get(
            f"/api/books/{book_id}/chapters/01-chapter-one.txt"
        )
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert len(data["content"]) > 0

    def test_get_missing_chapter_returns_404(self, client_with_book):
        client, book_id = client_with_book
        assert (
            client.get(f"/api/books/{book_id}/chapters/99-missing.txt").status_code
            == 404
        )

    def test_delete_book_succeeds(self, client_with_book):
        client, book_id = client_with_book
        response = client.delete(f"/api/books/{book_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"
        # Book should now be gone
        assert client.get(f"/api/books/{book_id}").status_code == 404


# ---------------------------------------------------------------------------
# Notes endpoints
# ---------------------------------------------------------------------------


class TestNotesEndpoints:
    def test_list_notes_empty(self, client_with_book):
        client, book_id = client_with_book
        response = client.get(f"/api/books/{book_id}/notes")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_missing_note_returns_404(self, client_with_book):
        client, book_id = client_with_book
        assert (
            client.get(f"/api/books/{book_id}/notes/missing.txt").status_code == 404
        )

    def test_delete_missing_note_returns_404(self, client_with_book):
        client, book_id = client_with_book
        assert (
            client.delete(f"/api/books/{book_id}/notes/missing.txt").status_code
            == 404
        )

    def test_path_traversal_rejected(self, client_with_book):
        client, book_id = client_with_book
        response = client.get(
            f"/api/books/{book_id}/notes/../../etc/passwd"
        )
        assert response.status_code in (400, 404)

    def test_list_notes_with_existing_notes(self, client_with_book, tmp_path):
        client, book_id = client_with_book
        # Manually create a notes directory + note file
        notes_dir = tmp_path / f"{book_id}_notes"
        notes_dir.mkdir()
        (notes_dir / "my_note.txt").write_text("A note about the book.")

        response = client.get(f"/api/books/{book_id}/notes")
        assert response.status_code == 200
        notes = response.json()
        assert len(notes) == 1
        assert notes[0]["filename"] == "my_note.txt"

    def test_read_existing_note(self, client_with_book, tmp_path):
        client, book_id = client_with_book
        notes_dir = tmp_path / f"{book_id}_notes"
        notes_dir.mkdir()
        (notes_dir / "review.txt").write_text("My review content.")

        response = client.get(f"/api/books/{book_id}/notes/review.txt")
        assert response.status_code == 200
        assert response.json()["content"] == "My review content."

    def test_delete_existing_note(self, client_with_book, tmp_path):
        client, book_id = client_with_book
        notes_dir = tmp_path / f"{book_id}_notes"
        notes_dir.mkdir()
        note_path = notes_dir / "draft.txt"
        note_path.write_text("Draft note.")

        response = client.delete(f"/api/books/{book_id}/notes/draft.txt")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"
        assert not note_path.exists()


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------


class TestChatEndpoint:
    def test_chat_unknown_book_returns_404(self, client):
        response = client.post(
            "/api/books/unknown-book/chat",
            json={"message": "Hello", "current_chapter": None},
        )
        assert response.status_code == 404

    def test_chat_without_sdk_client_returns_503(self, client_with_book):
        """When the Copilot SDK is not connected, the endpoint returns 503."""
        client, book_id = client_with_book
        response = client.post(
            f"/api/books/{book_id}/chat",
            json={"message": "Hello", "current_chapter": None},
        )
        # chat_manager._client is None (SDK not started) → 503
        assert response.status_code == 503
