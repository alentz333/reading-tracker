'use client';

import { useState, useRef } from 'react';
import { Book, ReadingStatus, GoodreadsCSVRow } from '@/types/book';
import { generateId } from '@/lib/storage';

interface GoodreadsImportProps {
  onImport: (books: Book[]) => void;
}

export default function GoodreadsImport({ onImport }: GoodreadsImportProps) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Book[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): GoodreadsCSVRow[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const rows: GoodreadsCSVRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Handle CSV with quoted fields containing commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/"/g, '') || '';
      });
      
      rows.push(row as GoodreadsCSVRow);
    }
    
    return rows;
  };

  const mapStatus = (shelf: string): ReadingStatus => {
    const s = shelf.toLowerCase();
    if (s === 'read') return 'read';
    if (s === 'currently-reading') return 'reading';
    return 'want-to-read';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      const books: Book[] = rows.map(row => ({
        id: generateId(),
        title: row.Title || 'Unknown Title',
        author: row.Author || 'Unknown Author',
        isbn: row.ISBN13 || row.ISBN || undefined,
        pageCount: row['Number of Pages'] ? parseInt(row['Number of Pages']) : undefined,
        publishedYear: row['Year Published'] ? parseInt(row['Year Published']) : undefined,
        status: mapStatus(row['Exclusive Shelf']),
        rating: row['My Rating'] && row['My Rating'] !== '0' ? parseInt(row['My Rating']) : undefined,
        dateFinished: row['Date Read'] || undefined,
        review: row['My Review'] || undefined,
        addedAt: row['Date Added'] || new Date().toISOString(),
        source: 'goodreads' as const,
      }));
      
      setPreview(books);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error parsing CSV. Make sure it\'s a valid Goodreads export.');
    }
    
    setImporting(false);
  };

  const confirmImport = () => {
    onImport(preview);
    setPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cancelImport = () => {
    setPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-[var(--color-forest)] mb-4">
        Import from Goodreads
      </h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Export your Goodreads library as CSV from{' '}
        <a
          href="https://www.goodreads.com/review/import"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-forest)] underline"
        >
          goodreads.com/review/import
        </a>
        {' '}and upload it here.
      </p>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
        id="csv-upload"
      />
      
      <label
        htmlFor="csv-upload"
        className="btn-secondary cursor-pointer inline-block"
      >
        {importing ? 'Processing...' : 'Choose CSV File'}
      </label>
      
      {/* Preview */}
      {preview.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--color-ink)]">
              Preview ({preview.length} books)
            </h3>
            <div className="flex gap-2">
              <button onClick={confirmImport} className="btn-primary text-sm">
                Import All
              </button>
              <button onClick={cancelImport} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {preview.slice(0, 20).map((book, i) => (
              <div key={i} className="text-sm p-2 bg-[var(--color-parchment)] rounded flex justify-between">
                <span className="truncate">
                  <strong>{book.title}</strong> by {book.author}
                </span>
                <span className={`shelf-tag ${
                  book.status === 'read' ? 'shelf-read' : 
                  book.status === 'reading' ? 'shelf-reading' : 'shelf-want'
                }`}>
                  {book.status}
                </span>
              </div>
            ))}
            {preview.length > 20 && (
              <p className="text-sm text-gray-500 text-center">
                ...and {preview.length - 20} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
