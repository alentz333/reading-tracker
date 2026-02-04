'use client';

import { ReadingStats } from '@/types/book';
import UserMenu from '@/components/auth/UserMenu';

interface HeaderProps {
  stats: ReadingStats;
}

export default function Header({ stats }: HeaderProps) {
  return (
    <header className="bg-[var(--color-forest)] text-white py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-wide">
                📚 Reading Journey
              </h1>
              <p className="text-[var(--color-cream)] opacity-80 mt-2 text-lg">
                Track your literary adventures
              </p>
            </div>
            <div className="md:hidden">
              <UserMenu />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--color-gold)]">
                  {stats.totalBooks}
                </div>
                <div className="text-sm opacity-80">Books Read</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--color-gold)]">
                  {stats.booksThisYear}
                </div>
                <div className="text-sm opacity-80">This Year</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--color-gold)]">
                  {stats.currentlyReading}
                </div>
                <div className="text-sm opacity-80">Reading</div>
              </div>
            </div>
            <div className="hidden md:block">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
