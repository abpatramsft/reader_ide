import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Upload, Trash2, User, Calendar } from "lucide-react";
import { fetchBooks, uploadEpub, deleteBook } from "../api";
import type { BookMeta } from "../types";
import "./Library.css";

export default function Library() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBooks();
      setBooks(data);
      setError(null);
    } catch {
      setError("Failed to load library. Is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      setError("Only .epub files are accepted");
      return;
    }
    try {
      setUploading(true);
      setError(null);
      await uploadEpub(file);
      await loadBooks();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleDelete = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this book from your library?")) return;
    try {
      await deleteBook(bookId);
      await loadBooks();
    } catch {
      setError("Failed to delete book");
    }
  };

  return (
    <div className="library-page">
      {/* Header */}
      <header className="library-header">
        <div className="library-header-left">
          <BookOpen size={28} />
          <h1>Reader IDE</h1>
        </div>
        <p className="library-subtitle">
          Your personal book library — Upload an EPUB to start reading
        </p>
      </header>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("epub-input")?.click()}
      >
        <Upload size={32} />
        <p>
          {uploading
            ? "Processing EPUB..."
            : "Drop an EPUB file here, or click to browse"}
        </p>
        <input
          id="epub-input"
          type="file"
          accept=".epub"
          hidden
          onChange={handleFileInput}
        />
      </div>

      {/* Error */}
      {error && <div className="library-error">{error}</div>}

      {/* Book Grid */}
      {loading ? (
        <div className="library-loading">Loading library...</div>
      ) : books.length === 0 ? (
        <div className="library-empty">
          <BookOpen size={48} strokeWidth={1} />
          <p>No books yet. Upload an EPUB to get started!</p>
        </div>
      ) : (
        <div className="book-grid">
          {books.map((book) => (
            <div
              key={book.book_id}
              className="book-card"
              onClick={() => navigate(`/read/${book.book_id}`)}
            >
              <div className="book-card-cover">
                <BookOpen size={40} />
              </div>
              <div className="book-card-info">
                <h3 className="book-card-title">{book.title}</h3>
                {book.authors.length > 0 && (
                  <p className="book-card-author">
                    <User size={14} />
                    {book.authors.join(", ")}
                  </p>
                )}
                <p className="book-card-chapters">
                  <Calendar size={14} />
                  {book.chapters.length} chapters
                </p>
              </div>
              <button
                className="book-card-delete"
                title="Delete book"
                onClick={(e) => handleDelete(book.book_id, e)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
