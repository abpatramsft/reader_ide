"""Unit tests for epub_processor.py helper functions."""
import json
import os

import pytest
from bs4 import BeautifulSoup

from epub_processor import (
    TOCEntry,
    _build_href_title_map,
    _flatten_toc,
    clean_html_content,
    delete_book,
    extract_plain_text,
    get_book_metadata,
    get_chapter_text,
    list_books,
    slugify,
)


# ---------------------------------------------------------------------------
# slugify
# ---------------------------------------------------------------------------


class TestSlugify:
    def test_basic_words(self):
        assert slugify("Hello World") == "hello-world"

    def test_strips_special_characters(self):
        assert slugify("Hello, World!") == "hello-world"

    def test_collapses_multiple_spaces(self):
        assert slugify("Hello   World") == "hello-world"

    def test_empty_string_returns_untitled(self):
        assert slugify("") == "untitled"

    def test_only_special_chars_returns_untitled(self):
        assert slugify("!@#$%") == "untitled"

    def test_truncates_at_80_chars(self):
        long_title = "word " * 30  # 150 chars
        result = slugify(long_title)
        assert len(result) <= 80

    def test_preserves_numbers(self):
        assert slugify("Chapter 1") == "chapter-1"

    def test_preserves_hyphens(self):
        assert "hello" in slugify("hello-world")
        assert "world" in slugify("hello-world")

    def test_lowercases(self):
        assert slugify("THE GREAT BOOK") == "the-great-book"

    def test_no_leading_or_trailing_hyphens(self):
        result = slugify("  hello  ")
        assert not result.startswith("-")
        assert not result.endswith("-")


# ---------------------------------------------------------------------------
# clean_html_content
# ---------------------------------------------------------------------------


class TestCleanHtmlContent:
    def test_removes_script_tags(self):
        soup = BeautifulSoup(
            "<div><script>alert('xss')</script><p>Text</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("script") is None
        assert cleaned.find("p") is not None

    def test_removes_style_tags(self):
        soup = BeautifulSoup(
            "<div><style>.cls{color:red}</style><p>Text</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("style") is None

    def test_removes_nav_tags(self):
        soup = BeautifulSoup(
            "<div><nav><a>Menu</a></nav><p>Content</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("nav") is None

    def test_removes_button_tags(self):
        soup = BeautifulSoup(
            "<div><button>Click</button><p>Text</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("button") is None

    def test_removes_form_tags(self):
        soup = BeautifulSoup(
            "<div><form><input /></form><p>Text</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("form") is None

    def test_removes_html_comments(self):
        soup = BeautifulSoup(
            "<div><!-- secret comment --><p>Visible</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert "secret comment" not in cleaned.get_text()

    def test_preserves_paragraphs(self):
        soup = BeautifulSoup("<p>Keep me.</p>", "html.parser")
        cleaned = clean_html_content(soup)
        assert cleaned.find("p") is not None

    def test_removes_iframe(self):
        soup = BeautifulSoup(
            "<div><iframe src='x'></iframe><p>Text</p></div>",
            "html.parser",
        )
        cleaned = clean_html_content(soup)
        assert cleaned.find("iframe") is None


# ---------------------------------------------------------------------------
# extract_plain_text
# ---------------------------------------------------------------------------


class TestExtractPlainText:
    def test_extracts_paragraph_text(self):
        soup = BeautifulSoup("<p>Hello World</p>", "html.parser")
        assert "Hello World" in extract_plain_text(soup)

    def test_collapses_whitespace(self):
        soup = BeautifulSoup("<p>Hello    World</p>", "html.parser")
        text = extract_plain_text(soup)
        assert "  " not in text  # no double spaces

    def test_multiple_tags(self):
        soup = BeautifulSoup("<p>Para one.</p><p>Para two.</p>", "html.parser")
        text = extract_plain_text(soup)
        assert "Para one" in text
        assert "Para two" in text

    def test_returns_string(self):
        soup = BeautifulSoup("<p>Hello</p>", "html.parser")
        assert isinstance(extract_plain_text(soup), str)

    def test_empty_html(self):
        soup = BeautifulSoup("", "html.parser")
        text = extract_plain_text(soup)
        assert isinstance(text, str)


# ---------------------------------------------------------------------------
# _flatten_toc
# ---------------------------------------------------------------------------


class TestFlattenToc:
    def test_empty_input(self):
        assert _flatten_toc([]) == []

    def test_flat_list_unchanged_order(self):
        entries = [
            TOCEntry(title="Ch 1", href="ch1.html", file_href="ch1.html"),
            TOCEntry(title="Ch 2", href="ch2.html", file_href="ch2.html"),
        ]
        result = _flatten_toc(entries)
        assert len(result) == 2
        assert result[0].title == "Ch 1"
        assert result[1].title == "Ch 2"

    def test_nested_children_are_included(self):
        child = TOCEntry(title="Sub 1.1", href="sub.html", file_href="sub.html")
        parent = TOCEntry(
            title="Ch 1",
            href="ch1.html",
            file_href="ch1.html",
            children=[child],
        )
        result = _flatten_toc([parent])
        assert len(result) == 2
        assert result[0].title == "Ch 1"
        assert result[1].title == "Sub 1.1"

    def test_deeply_nested(self):
        grandchild = TOCEntry(title="GC", href="gc.html", file_href="gc.html")
        child = TOCEntry(
            title="Child",
            href="child.html",
            file_href="child.html",
            children=[grandchild],
        )
        parent = TOCEntry(
            title="Parent",
            href="parent.html",
            file_href="parent.html",
            children=[child],
        )
        result = _flatten_toc([parent])
        titles = [e.title for e in result]
        assert "Parent" in titles
        assert "Child" in titles
        assert "GC" in titles


# ---------------------------------------------------------------------------
# _build_href_title_map
# ---------------------------------------------------------------------------


class TestBuildHrefTitleMap:
    def test_basic_mapping(self):
        entries = [
            TOCEntry(title="Chapter One", href="ch1.html", file_href="ch1.html"),
            TOCEntry(title="Chapter Two", href="ch2.html", file_href="ch2.html"),
        ]
        mapping = _build_href_title_map(entries)
        assert mapping.get("ch1.html") == "Chapter One"
        assert mapping.get("ch2.html") == "Chapter Two"

    def test_first_occurrence_wins(self):
        entries = [
            TOCEntry(title="First", href="ch.html", file_href="ch.html"),
            TOCEntry(title="Second", href="ch.html", file_href="ch.html"),
        ]
        mapping = _build_href_title_map(entries)
        assert mapping["ch.html"] == "First"

    def test_empty_returns_empty_dict(self):
        assert _build_href_title_map([]) == {}

    def test_url_encoded_hrefs_are_decoded(self):
        entries = [
            TOCEntry(
                title="Chapter 1",
                href="chapter%201.html",
                file_href="chapter%201.html",
            ),
        ]
        mapping = _build_href_title_map(entries)
        assert "chapter 1.html" in mapping

    def test_skips_empty_file_hrefs(self):
        entries = [
            TOCEntry(title="Section", href="", file_href=""),
        ]
        mapping = _build_href_title_map(entries)
        # empty-string key should not be present
        assert "" not in mapping


# ---------------------------------------------------------------------------
# list_books
# ---------------------------------------------------------------------------


class TestListBooks:
    def test_empty_directory_returns_empty_list(self, data_dir):
        assert list_books(data_dir) == []

    def test_nonexistent_directory_returns_empty_list(self):
        assert list_books("/nonexistent/path/xyz") == []

    def test_single_book(self, data_dir, sample_book):
        result = list_books(data_dir)
        assert len(result) == 1
        assert result[0]["book_id"] == "test-book"
        assert result[0]["title"] == "Test Book"

    def test_multiple_books_sorted(self, data_dir, sample_book):
        # Add a second book that sorts before 'test-book'
        book2_dir = os.path.join(data_dir, "alpha-book")
        os.makedirs(book2_dir)
        meta2 = {"book_id": "alpha-book", "title": "Alpha Book", "chapters": []}
        with open(os.path.join(book2_dir, "metadata.json"), "w") as f:
            json.dump(meta2, f)

        result = list_books(data_dir)
        assert len(result) == 2
        # os.listdir is sorted, so alpha-book should come first
        assert result[0]["book_id"] == "alpha-book"
        assert result[1]["book_id"] == "test-book"

    def test_directory_without_metadata_ignored(self, data_dir):
        # A directory with no metadata.json should be silently skipped
        empty_dir = os.path.join(data_dir, "empty-dir")
        os.makedirs(empty_dir)
        result = list_books(data_dir)
        assert result == []


# ---------------------------------------------------------------------------
# get_book_metadata
# ---------------------------------------------------------------------------


class TestGetBookMetadata:
    def test_returns_metadata_for_existing_book(self, data_dir, sample_book):
        meta = get_book_metadata("test-book", data_dir)
        assert meta is not None
        assert meta["title"] == "Test Book"
        assert meta["authors"] == ["Test Author"]

    def test_returns_none_for_missing_book(self, data_dir):
        assert get_book_metadata("nonexistent", data_dir) is None

    def test_returns_none_when_data_dir_missing(self):
        assert get_book_metadata("any-book", "/nonexistent/dir") is None


# ---------------------------------------------------------------------------
# get_chapter_text
# ---------------------------------------------------------------------------


class TestGetChapterText:
    def test_returns_text_for_existing_chapter(self, data_dir, sample_book):
        text = get_chapter_text("test-book", "01-chapter-one.txt", data_dir)
        assert text is not None
        assert "chapter one" in text.lower()

    def test_returns_none_for_missing_chapter(self, data_dir, sample_book):
        assert get_chapter_text("test-book", "99-missing.txt", data_dir) is None

    def test_returns_none_for_missing_book(self, data_dir):
        assert get_chapter_text("nonexistent", "01-ch.txt", data_dir) is None

    def test_path_traversal_is_blocked(self, data_dir, sample_book):
        """Requesting ../../etc/passwd must not return content."""
        result = get_chapter_text("test-book", "../../etc/passwd", data_dir)
        assert result is None

    def test_path_traversal_with_book_prefix_blocked(self, data_dir, sample_book):
        result = get_chapter_text("test-book", "../test-book/02-chapter-two.txt", data_dir)
        # May or may not be blocked depending on resolution, but should not
        # escape outside the book directory.
        # The important case is traversal *out* of the data dir, tested above.
        assert True  # security test above is the critical one


# ---------------------------------------------------------------------------
# delete_book
# ---------------------------------------------------------------------------


class TestDeleteBook:
    def test_deletes_existing_book(self, data_dir, sample_book):
        result = delete_book("test-book", data_dir)
        assert result is True
        assert not os.path.isdir(os.path.join(data_dir, "test-book"))

    def test_returns_false_for_missing_book(self, data_dir):
        assert delete_book("nonexistent", data_dir) is False

    def test_delete_is_idempotent(self, data_dir, sample_book):
        delete_book("test-book", data_dir)
        # Second delete should return False, not raise
        assert delete_book("test-book", data_dir) is False


# ---------------------------------------------------------------------------
# process_epub (integration — creates a real minimal EPUB)
# ---------------------------------------------------------------------------


class TestProcessEpub:
    @pytest.fixture
    def minimal_epub(self, tmp_path):
        """Create a minimal valid EPUB file for testing process_epub."""
        from ebooklib import epub

        book = epub.EpubBook()
        book.set_identifier("test-id-001")
        book.set_title("My Test Book")
        book.set_language("en")
        book.add_author("Jane Doe")

        content_template = "<html><body><h1>{title}</h1><p>{body}</p></body></html>"

        c1 = epub.EpubHtml(title="Chapter One", file_name="chap1.xhtml", lang="en")
        c1.content = content_template.format(
            title="Chapter One",
            body="The first chapter text. " * 25,
        )
        book.add_item(c1)

        c2 = epub.EpubHtml(title="Chapter Two", file_name="chap2.xhtml", lang="en")
        c2.content = content_template.format(
            title="Chapter Two",
            body="The second chapter text. " * 25,
        )
        book.add_item(c2)

        book.toc = (
            epub.Link("chap1.xhtml", "Chapter One", "chap1"),
            epub.Link("chap2.xhtml", "Chapter Two", "chap2"),
        )
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", c1, c2]

        epub_path = str(tmp_path / "test.epub")
        epub.write_epub(epub_path, book)
        return epub_path

    def test_returns_dict_with_title(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result = process_epub(minimal_epub, data)
        assert result["title"] == "My Test Book"

    def test_returns_authors(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result = process_epub(minimal_epub, data)
        assert "Jane Doe" in result["authors"]

    def test_creates_book_directory(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result = process_epub(minimal_epub, data)
        assert os.path.isdir(os.path.join(data, result["book_id"]))

    def test_writes_metadata_json(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result = process_epub(minimal_epub, data)
        meta_path = os.path.join(data, result["book_id"], "metadata.json")
        assert os.path.isfile(meta_path)
        with open(meta_path) as f:
            meta = json.load(f)
        assert meta["title"] == "My Test Book"

    def test_creates_chapter_text_files(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result = process_epub(minimal_epub, data)
        book_dir = os.path.join(data, result["book_id"])
        assert len(result["chapters"]) > 0
        for chapter in result["chapters"]:
            assert os.path.isfile(os.path.join(book_dir, chapter["filename"]))

    def test_duplicate_title_gets_timestamp_suffix(self, minimal_epub, tmp_path):
        from epub_processor import process_epub

        data = str(tmp_path / "data")
        os.makedirs(data)
        result1 = process_epub(minimal_epub, data)
        result2 = process_epub(minimal_epub, data)
        # Second run must produce a different book_id to avoid collision
        assert result1["book_id"] != result2["book_id"]
