'use client';

import { useState, useRef, useCallback } from 'react';
import { Book, ReadingStatus } from '@/types/book';
import { generateId } from '@/lib/storage';

interface CameraScannerProps {
  onAddBook: (book: Book) => void;
  onClose: () => void;
}

export default function CameraScanner({ onAddBook, onClose }: CameraScannerProps) {
  const [mode, setMode] = useState<'camera' | 'preview' | 'identifying' | 'result'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [identifiedBook, setIdentifiedBook] = useState<{ title: string; author: string } | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      setMode('preview');
      stopCamera();
    }
  }, [stopCamera]);

  const identifyBook = async () => {
    if (!capturedImage) return;
    
    setMode('identifying');
    setError(null);
    
    try {
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: capturedImage }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setMode('preview');
        return;
      }
      
      setIdentifiedBook(data);
      
      // Search Open Library for this book
      const searchResponse = await fetch(
        `/api/search?q=${encodeURIComponent(data.title + ' ' + data.author)}`
      );
      const searchData = await searchResponse.json();
      setSearchResults(searchData.books || []);
      setMode('result');
    } catch (err) {
      console.error('Identify error:', err);
      setError('Failed to identify book. Try again or add manually.');
      setMode('preview');
    }
  };

  const addBook = (result: any, status: ReadingStatus) => {
    const book: Book = {
      id: generateId(),
      title: result.title || identifiedBook?.title || 'Unknown',
      author: result.author || identifiedBook?.author || 'Unknown',
      coverUrl: result.coverUrl,
      isbn: result.isbn,
      pageCount: result.pageCount,
      publishedYear: result.publishedYear,
      status,
      addedAt: new Date().toISOString(),
      source: 'openlibrary',
    };
    
    if (status === 'reading') {
      book.dateStarted = new Date().toISOString().split('T')[0];
    } else if (status === 'read') {
      book.dateFinished = new Date().toISOString().split('T')[0];
    }
    
    onAddBook(book);
    onClose();
  };

  const retake = () => {
    setCapturedImage(null);
    setIdentifiedBook(null);
    setSearchResults([]);
    setError(null);
    setMode('camera');
    startCamera();
  };

  // Start camera on mount
  useState(() => {
    startCamera();
    return () => stopCamera();
  });

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">📷 Scan Book Cover</h2>
        <button onClick={() => { stopCamera(); onClose(); }} className="text-2xl">✕</button>
      </div>
      
      {/* Camera View */}
      {mode === 'camera' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => videoRef.current?.play()}
            />
            <div className="absolute inset-4 border-2 border-white/50 rounded-lg pointer-events-none" />
          </div>
          
          {error && (
            <p className="text-red-400 mt-4 text-center">{error}</p>
          )}
          
          <button
            onClick={capturePhoto}
            className="mt-6 w-20 h-20 rounded-full bg-white flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-300" />
          </button>
          
          <p className="text-white/60 mt-4 text-sm text-center">
            Point at the book cover and tap to capture
          </p>
        </div>
      )}
      
      {/* Preview */}
      {mode === 'preview' && capturedImage && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md aspect-[3/4] rounded-lg overflow-hidden">
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          </div>
          
          {error && (
            <p className="text-red-400 mt-4 text-center">{error}</p>
          )}
          
          <div className="flex gap-4 mt-6">
            <button onClick={retake} className="btn-secondary bg-white/10 text-white border-white/30">
              Retake
            </button>
            <button onClick={identifyBook} className="btn-primary">
              Identify Book
            </button>
          </div>
        </div>
      )}
      
      {/* Identifying */}
      {mode === 'identifying' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-white text-xl">Identifying book...</p>
          <p className="text-white/60 mt-2">This may take a few seconds</p>
        </div>
      )}
      
      {/* Results */}
      {mode === 'result' && identifiedBook && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">Identified as:</p>
              <h3 className="text-xl font-semibold text-[var(--color-forest)]">
                {identifiedBook.title}
              </h3>
              <p className="text-gray-600">by {identifiedBook.author}</p>
            </div>
            
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                <p className="text-white/80 text-sm">Select the correct edition:</p>
                {searchResults.map((result, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 flex gap-3">
                    {result.coverUrl ? (
                      <img src={result.coverUrl} alt="" className="w-12 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">📖</div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{result.title}</p>
                      <p className="text-xs text-gray-500">{result.author}</p>
                      {result.publishedYear && (
                        <p className="text-xs text-gray-400">{result.publishedYear}</p>
                      )}
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => addBook(result, 'read')}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                        >
                          Read
                        </button>
                        <button
                          onClick={() => addBook(result, 'reading')}
                          className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded"
                        >
                          Reading
                        </button>
                        <button
                          onClick={() => addBook(result, 'want-to-read')}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                        >
                          Want
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-4">
                <p className="text-gray-600 mb-3">No exact matches found. Add with identified info?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => addBook({ title: identifiedBook.title, author: identifiedBook.author }, 'read')}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                  >
                    Read
                  </button>
                  <button
                    onClick={() => addBook({ title: identifiedBook.title, author: identifiedBook.author }, 'reading')}
                    className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded"
                  >
                    Reading
                  </button>
                  <button
                    onClick={() => addBook({ title: identifiedBook.title, author: identifiedBook.author }, 'want-to-read')}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                  >
                    Want to Read
                  </button>
                </div>
              </div>
            )}
            
            <button onClick={retake} className="w-full mt-4 btn-secondary bg-white/10 text-white border-white/30">
              Scan Another
            </button>
          </div>
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
