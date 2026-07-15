interface BookCoverPlaceholderProps {
  title: string;
  /** Sizing, rounding, and layout classes for the cover box (e.g. "w-20 h-28 rounded-lg") */
  className?: string;
  /** Override title text styling for very small or very large covers */
  textClassName?: string;
}

export default function BookCoverPlaceholder({
  title,
  className = '',
  textClassName = 'text-[10px] line-clamp-4',
}: BookCoverPlaceholderProps) {
  return (
    <div
      className={`bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden px-1.5 py-1 text-center ${className}`}
    >
      <span className={`text-white/90 font-semibold leading-tight break-words ${textClassName}`}>
        {title}
      </span>
    </div>
  );
}
