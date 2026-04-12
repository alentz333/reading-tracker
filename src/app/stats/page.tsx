'use client';

import { useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBooks } from '@/hooks/useBooks';
import Header from '@/components/Header';
import Link from 'next/link';
import { getBookReadYear } from '@/lib/storage';

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { books, stats, loading: booksLoading } = useBooks();

  const loading = authLoading || booksLoading;

  const derivedStats = useMemo(() => {
    const readBooks = books.filter(b => b.status === 'read');

    // Rating distribution
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    readBooks.forEach(b => {
      if (b.rating && b.rating >= 1 && b.rating <= 5) {
        ratingDist[b.rating]++;
      }
    });

    // Top authors (by books read)
    const authorCounts: Record<string, number> = {};
    readBooks.forEach(b => {
      if (b.author) {
        authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
      }
    });
    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Pages stats
    const booksWithPages = readBooks.filter(b => b.pageCount && b.pageCount > 0);
    const totalPagesAllTime = booksWithPages.reduce((sum, b) => sum + (b.pageCount || 0), 0);
    const avgPages = booksWithPages.length > 0
      ? Math.round(totalPagesAllTime / booksWithPages.length)
      : 0;
    const longestBook = booksWithPages.reduce<typeof books[0] | null>(
      (max, b) => (!max || (b.pageCount || 0) > (max.pageCount || 0)) ? b : max,
      null
    );

    // Books by year — sorted descending
    const byYearSorted = Object.entries(stats.byYear)
      .map(([year, count]) => ({ year: Number(year), count }))
      .sort((a, b) => b.year - a.year);

    // Genre sorted descending
    const genreSorted = Object.entries(stats.byGenre)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    // Fastest / most recent reads (last 5 finished)
    const recentlyRead = [...readBooks]
      .filter(b => b.dateFinished)
      .sort((a, b) => new Date(b.dateFinished!).getTime() - new Date(a.dateFinished!).getTime())
      .slice(0, 5);

    return {
      ratingDist,
      topAuthors,
      totalPagesAllTime,
      avgPages,
      longestBook,
      byYearSorted,
      genreSorted,
      recentlyRead,
      ratedCount: readBooks.filter(b => b.rating).length,
    };
  }, [books, stats]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-white/60">Loading stats...</div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bento-card text-center py-16">
            <div className="text-5xl mb-4">📊</div>
            <h1 className="text-2xl font-bold text-white mb-2">Reading Stats</h1>
            <p className="text-white/50 mb-6">Sign in to see your personal reading statistics.</p>
            <Link href="/auth/signup" className="btn btn-primary">Get Started</Link>
          </div>
        </main>
      </div>
    );
  }

  const maxYearCount = Math.max(...derivedStats.byYearSorted.map(y => y.count), 1);
  const maxGenreCount = Math.max(...derivedStats.genreSorted.map(g => g[1]), 1);
  const maxAuthorCount = Math.max(...derivedStats.topAuthors.map(a => a[1]), 1);
  const maxRatingCount = Math.max(...Object.values(derivedStats.ratingDist), 1);
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">📊 Reading Stats</h1>
          <p className="text-white/50">Your complete reading history at a glance.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Books Read', value: stats.totalBooks, icon: '📚', color: 'text-indigo-400' },
            { label: `Read in ${currentYear}`, value: stats.booksThisYear, icon: '📅', color: 'text-green-400' },
            { label: `Pages in ${currentYear}`, value: stats.pagesThisYear.toLocaleString(), icon: '📄', color: 'text-blue-400' },
            { label: 'Pages All Time', value: derivedStats.totalPagesAllTime.toLocaleString(), icon: '📖', color: 'text-purple-400' },
            { label: 'Avg Rating', value: stats.averageRating > 0 ? `${stats.averageRating} ★` : '—', icon: '⭐', color: 'text-yellow-400' },
            { label: 'Avg Page Count', value: derivedStats.avgPages > 0 ? derivedStats.avgPages.toLocaleString() : '—', icon: '📏', color: 'text-orange-400' },
          ].map(card => (
            <div key={card.label} className="bento-card text-center py-4">
              <div className="text-2xl mb-1">{card.icon}</div>
              <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-white/40 mt-0.5 leading-tight">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Books per year */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Books Per Year</h2>
            {derivedStats.byYearSorted.length === 0 ? (
              <p className="text-white/40 text-sm">No data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {derivedStats.byYearSorted.map(({ year, count }) => (
                  <div key={year} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-10 text-right shrink-0">{year}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded transition-all duration-500"
                        style={{ width: `${(count / maxYearCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/70 w-5 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Genre breakdown */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Top Genres</h2>
            {derivedStats.genreSorted.length === 0 ? (
              <p className="text-white/40 text-sm">No genre data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {derivedStats.genreSorted.map(([genre, count]) => (
                  <div key={genre} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-24 truncate shrink-0">{genre}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded transition-all duration-500"
                        style={{ width: `${(count / maxGenreCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/70 w-5 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Rating distribution */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">
              Rating Distribution
              <span className="text-xs text-white/40 font-normal ml-2">({derivedStats.ratedCount} rated)</span>
            </h2>
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-10 text-right shrink-0">
                    {'★'.repeat(star)}
                  </span>
                  <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded transition-all duration-500"
                      style={{ width: `${(derivedStats.ratingDist[star] / maxRatingCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-white/70 w-5 shrink-0">
                    {derivedStats.ratingDist[star]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top authors */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Most-Read Authors</h2>
            {derivedStats.topAuthors.length === 0 ? (
              <p className="text-white/40 text-sm">No data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {derivedStats.topAuthors.map(([author, count]) => (
                  <div key={author} className="flex items-center gap-3">
                    <span className="text-xs text-white/50 w-24 truncate shrink-0">{author}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded transition-all duration-500"
                        style={{ width: `${(count / maxAuthorCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/70 w-5 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reading backlog + longest book */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Current status breakdown */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Library Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Read', count: stats.totalBooks, color: 'bg-green-500', icon: '✅' },
                { label: 'Currently Reading', count: stats.currentlyReading, color: 'bg-blue-500', icon: '📖' },
                { label: 'Want to Read', count: stats.wantToRead, color: 'bg-indigo-500', icon: '🔖' },
              ].map(item => {
                const total = stats.totalBooks + stats.currentlyReading + stats.wantToRead;
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                      <span>{item.count} <span className="text-white/30">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-white/5 rounded overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Longest book + fun facts */}
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Highlights</h2>
            <div className="space-y-4">
              {derivedStats.longestBook && (
                <div>
                  <p className="text-xs text-white/40 mb-1">Longest book read</p>
                  <p className="text-sm text-white font-medium truncate">{derivedStats.longestBook.title}</p>
                  <p className="text-xs text-white/50">{derivedStats.longestBook.pageCount?.toLocaleString()} pages · {derivedStats.longestBook.author}</p>
                </div>
              )}
              {derivedStats.avgPages > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-1">Average book length</p>
                  <p className="text-sm text-white font-medium">{derivedStats.avgPages.toLocaleString()} pages</p>
                </div>
              )}
              {derivedStats.topAuthors[0] && (
                <div>
                  <p className="text-xs text-white/40 mb-1">Favourite author</p>
                  <p className="text-sm text-white font-medium">{derivedStats.topAuthors[0][0]}</p>
                  <p className="text-xs text-white/50">{derivedStats.topAuthors[0][1]} book{derivedStats.topAuthors[0][1] !== 1 ? 's' : ''} read</p>
                </div>
              )}
              {derivedStats.genreSorted[0] && (
                <div>
                  <p className="text-xs text-white/40 mb-1">Top genre</p>
                  <p className="text-sm text-white font-medium">{derivedStats.genreSorted[0][0]}</p>
                  <p className="text-xs text-white/50">{derivedStats.genreSorted[0][1]} book{derivedStats.genreSorted[0][1] !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recently finished */}
        {derivedStats.recentlyRead.length > 0 && (
          <div className="bento-card">
            <h2 className="text-base font-semibold text-white mb-4">Recently Finished</h2>
            <div className="divide-y divide-white/5">
              {derivedStats.recentlyRead.map(book => (
                <div key={book.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-9 h-13 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-9 h-13 bg-white/5 rounded flex items-center justify-center text-lg shrink-0">📚</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{book.title}</p>
                    <p className="text-xs text-white/50 truncate">{book.author}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {book.rating && (
                      <p className="text-xs text-yellow-400">{'★'.repeat(book.rating)}</p>
                    )}
                    {book.dateFinished && (
                      <p className="text-xs text-white/30">
                        {new Date(book.dateFinished).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {stats.totalBooks === 0 && !loading && (
          <div className="bento-card text-center py-16 mt-4">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-white mb-2">No stats yet</h3>
            <p className="text-white/50 mb-6">Mark some books as read to start seeing your stats.</p>
            <Link href="/" className="btn btn-primary">Go to Library</Link>
          </div>
        )}
      </main>
    </div>
  );
}
