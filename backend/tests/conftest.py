"""
Pytest configuration and shared fixtures for Reader IDE backend tests.

Mocks the GitHub Copilot SDK before any app modules are imported so that
tests can run without the real SDK installed.
"""
import sys
import os
import json
import pytest
from unittest.mock import MagicMock, AsyncMock

# ---------------------------------------------------------------------------
# Add backend/ to sys.path so test files can import app modules directly
# ---------------------------------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ---------------------------------------------------------------------------
# Mock the copilot SDK *before* any app module is imported.
# conftest.py is loaded by pytest before test files, so these mocks are in
# place when test files do `from main import app` etc.
# ---------------------------------------------------------------------------


def _mock_define_tool(description=""):
    """Identity decorator factory matching the copilot @define_tool API."""
    def decorator(fn):
        return fn
    return decorator


class _MockSessionEventType:
    """Enum-like class mirroring SessionEventType values used in chat_stream."""
    ASSISTANT_MESSAGE_DELTA = "assistant_message_delta"
    TOOL_EXECUTION_START = "tool_execution_start"
    TOOL_EXECUTION_COMPLETE = "tool_execution_complete"
    ASSISTANT_REASONING_DELTA = "assistant_reasoning_delta"
    SESSION_ERROR = "session_error"
    SESSION_IDLE = "session_idle"


# Build mock modules
_copilot_tools_mock = MagicMock()
_copilot_tools_mock.define_tool = _mock_define_tool

_session_events_mock = MagicMock()
_session_events_mock.SessionEventType = _MockSessionEventType

_copilot_mock = MagicMock()
# Make CopilotClient() return an AsyncMock so that
# `await client.start()` / `await client.stop()` work in tests.
_copilot_mock.CopilotClient.return_value = AsyncMock()

sys.modules.setdefault("copilot", _copilot_mock)
sys.modules.setdefault("copilot.tools", _copilot_tools_mock)
sys.modules.setdefault("copilot.generated", MagicMock())
sys.modules.setdefault("copilot.generated.session_events", _session_events_mock)

# No real GitHub token during tests — prevents the lifespan from trying to
# start the real Copilot client.
os.environ.pop("GITHUB_TOKEN", None)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def data_dir(tmp_path):
    """Return a temporary directory for use as the book data store."""
    return str(tmp_path)


@pytest.fixture
def sample_book(data_dir):
    """
    Create a minimal book folder inside *data_dir* and return info about it.
    Yields a dict with keys: book_id, book_dir, meta.
    """
    book_id = "test-book"
    book_dir = os.path.join(data_dir, book_id)
    os.makedirs(book_dir)

    meta = {
        "book_id": book_id,
        "title": "Test Book",
        "authors": ["Test Author"],
        "language": "en",
        "description": "A test book",
        "publisher": None,
        "date": None,
        "subjects": [],
        "chapters": [
            {
                "filename": "01-chapter-one.txt",
                "title": "Chapter One",
                "order": 1,
                "char_count": 100,
            },
            {
                "filename": "02-chapter-two.txt",
                "title": "Chapter Two",
                "order": 2,
                "char_count": 200,
            },
        ],
        "processed_at": "2024-01-01T00:00:00",
    }

    with open(os.path.join(book_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)

    with open(os.path.join(book_dir, "01-chapter-one.txt"), "w", encoding="utf-8") as f:
        f.write("This is chapter one content. " * 10)

    with open(os.path.join(book_dir, "02-chapter-two.txt"), "w", encoding="utf-8") as f:
        f.write("This is chapter two content. " * 20)

    return {"book_id": book_id, "book_dir": book_dir, "meta": meta}
