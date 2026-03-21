'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useBooks } from '@/hooks/useBooks';
import { getBookReadYear } from '@/lib/storage';
import {
  createPreviousReadBook,
  normalizeYear,
  parsePreviousReadsCsv,
} from '@/lib/previous-reads';

export default function PreviousReadsPage() {
  const { books, loading, stats, addBook, deleteBook } = useBooks();
  const [manualTitle, setManualTitle] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [deletingYearKey, setDeletingYearKey] = useState<string | null>(null);

  const readBooksByYear = useMemo(() => {
    const grouped: Record<string, { id: string; title: string }[]> = {};

    books
      .filter((book) => book.status === 'read')
      .forEach(book => {
        const year = getBookReadYear(book);
        const key = year ? String(year) : 'Unknown';
        grouped[key] = grouped[key] || [];
        grouped[key].push({ id: book.id, title: book.title });
      });

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return Number.parseInt(b, 10) - Number.parseInt(a, 10);
      })
      .map(([year, entries]) => ({
        year,
        entries: [...entries].sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [books]);

  const addPreviousRead = async (title: string, yearRead?: number) => {
    const success = await addBook(createPreviousReadBook(title, yearRead));
    return success;
  };

  const handleManualAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    const title = manualTitle.trim();
    if (!title) return;

    const yearRead = normalizeYear(manualYear);
    setImporting(true);
    setImportMessage(null);

    try {
      const success = await addPreviousRead(title, yearRead);
      if (success) {
        setManualTitle('');
        setManualYear('');
        setImportMessage(`Added “${title}”${yearRead ? ` (${yearRead})` : ''}.`);
      } else {
        setImportMessage('Could not add that book. Please try again.');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const text = await file.text();
      const rows = parsePreviousReadsCsv(text);

      if (rows.length === 0) {
        setImportMessage('No valid rows found. Use CSV columns: title, yearRead (optional).');
        return;
      }

      let added = 0;
      for (const row of rows) {
        const success = await addPreviousRead(row.title, row.yearRead);
        if (success) added++;
      }

      const failed = rows.length - added;
      setImportMessage(
        failed > 0
          ? `Imported ${added}/${rows.length} books. ${failed} failed.`
          : `Imported ${added} previous reads.`
      );
    } catch (error) {
      console.error('CSV import failed', error);
      setImportMessage('Could not parse CSV. Expected columns: title, yearRead (optional).');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleDeleteReadBook = async (bookId: string, title: string) => {
    setDeletingBookId(bookId);
    setImportMessage(null);

    try {
      const success = await deleteBook(bookId);
      if (success) {
        setImportMessage(`Removed “${title}”.`);
      } else {
        setImportMessage(`Could not remove “${title}”. Please try again.`);
      }
    } finally {
      setDeletingBookId(null);
    }
  };

  const handleDeleteYearSection = async (
    year: string,
    entries: { id: string; title: string }[]
  ) => {
    if (entries.length === 0) return;

    const label = year === 'Unknown' ? 'Unknown Year' : year;
    const confirmed = window.confirm(
      `Delete all ${entries.length} ${entries.length === 1 ? 'book' : 'books'} in ${label}?`
    );
    if (!confirmed) return;

    setDeletingYearKey(year);
    setImportMessage(null);

    try {
      const results = await Promise.all(entries.map((entry) => deleteBook(entry.id)));
      const removed = results.filter(Boolean).length;
      const failed = entries.length - removed;

      if (failed === 0) {
        setImportMessage(`Removed ${removed} ${removed === 1 ? 'book' : 'books'} from ${label}.`);
      } else {
        setImportMessage(`Removed ${removed}/${entries.length} books from ${label}. ${failed} failed.`);
      }
    } finally {
      setDeletingYearKey(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white/60">Loading your previous reads...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header stats={stats} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Link href="/" className="text-white/50 hover:text-white text-sm mb-4 inline-block">
          ← Back to Home
        </Link>

        <h1 className="text-2xl font-bold text-white mb-4">Previous Reads</h1>

        <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
          <Link
            href="/library"
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-sm font-medium transition-colors"
          >
            Library
          </Link>
          <Link
            href="/library/previous-reads"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium"
          >
            Previous Reads
          </Link>
        </div>

        {/* Previous Reads Import */}
        <section className="mb-8 p-4 md:p-5 rounded-xl border border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold text-white mb-1">📚 Add Previous Reads</h2>
          <p className="text-sm text-white/60 mb-4">
            Add older books manually or upload a CSV with columns <span className="text-white/80">title</span> and optional <span className="text-white/80">yearRead</span>.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={handleManualAdd} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-3">Manual Add</h3>
              <div className="space-y-3">
                <input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Book title"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  required
                />
                <input
                  value={manualYear}
                  onChange={(e) => setManualYear(e.target.value)}
                  placeholder="Year read (optional)"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  inputMode="numeric"
                />
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-colors"
                >
                  {importing ? 'Adding...' : 'Add Previous Read'}
                </button>
              </div>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-3">CSV Upload</h3>
              <label className="inline-flex items-center justify-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  disabled={importing}
                />
                {importing ? 'Importing...' : 'Upload CSV'}
              </label>
              <p className="text-xs text-white/40 mt-2">
                Example rows: <span className="text-white/60">Dune,2024</span> or <span className="text-white/60">The Hobbit</span>
              </p>
            </div>
          </div>

          {importMessage && (
            <p className="text-sm text-white/70 mt-4">{importMessage}</p>
          )}
        </section>

        {/* Books Read by Year */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">🗓️ Books Read by Year</h2>

          {readBooksByYear.length === 0 ? (
            <div className="text-white/50 text-sm bg-white/5 border border-white/10 rounded-lg p-4">
              No read books yet. Add previous reads above to start your timeline.
            </div>
          ) : (
            <div className="space-y-4">
              {readBooksByYear.map(group => {
                const groupLabel = group.year === 'Unknown' ? 'Unknown Year' : group.year;

                return (
                  <div key={group.year} className="group/section bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{groupLabel}</h3>
                        <button
                          type="button"
                          aria-label={`Delete ${groupLabel} section`}
                          title={`Delete all books in ${groupLabel}`}
                          onClick={() => handleDeleteYearSection(group.year, group.entries)}
                          disabled={deletingYearKey === group.year}
                          className="shrink-0 text-red-400 hover:text-red-300 disabled:opacity-50 opacity-0 group-hover/section:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">
                        {group.entries.length} {group.entries.length === 1 ? 'book' : 'books'}
                      </span>
                    </div>

                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                      {group.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="group/book flex items-center gap-1.5 text-sm text-white/75 min-w-0"
                        >
                          <span className="truncate">• {entry.title}</span>
                          <button
                            type="button"
                            aria-label={`Delete ${entry.title}`}
                            title="Delete book"
                            onClick={() => handleDeleteReadBook(entry.id, entry.title)}
                            disabled={deletingBookId === entry.id || deletingYearKey === group.year}
                            className="shrink-0 text-red-400 hover:text-red-300 disabled:opacity-50 opacity-0 group-hover/book:opacity-100 focus:opacity-100 transition-opacity"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
