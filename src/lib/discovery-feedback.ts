import { extractTitleKeywords, getBookFingerprint } from '@/lib/recommendations';

const STORAGE_KEY = 'reading-tracker-discovery-feedback-v1';

export interface DiscoveryFeedbackState {
  rejectedFingerprints: string[];
  rejectedAuthors: string[];
  rejectedTitleTerms: string[];
}

interface DislikedBookInput {
  title?: string;
  author?: string;
  fingerprint?: string;
}

const EMPTY_FEEDBACK: DiscoveryFeedbackState = {
  rejectedFingerprints: [],
  rejectedAuthors: [],
  rejectedTitleTerms: [],
};

function uniqueNormalized(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const normalized = values
    .map((value) => (value || '').trim().toLowerCase())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  return normalized.slice(0, limit);
}

function sanitizeFeedback(input?: Partial<DiscoveryFeedbackState> | null): DiscoveryFeedbackState {
  return {
    rejectedFingerprints: uniqueNormalized(input?.rejectedFingerprints || [], 300),
    rejectedAuthors: uniqueNormalized(input?.rejectedAuthors || [], 120),
    rejectedTitleTerms: uniqueNormalized(input?.rejectedTitleTerms || [], 300),
  };
}

export function loadDiscoveryFeedback(): DiscoveryFeedbackState {
  if (typeof window === 'undefined') return EMPTY_FEEDBACK;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_FEEDBACK;

    const parsed = JSON.parse(raw) as Partial<DiscoveryFeedbackState>;
    return sanitizeFeedback(parsed);
  } catch {
    return EMPTY_FEEDBACK;
  }
}

export function saveDiscoveryFeedback(state: DiscoveryFeedbackState): void {
  if (typeof window === 'undefined') return;

  const sanitized = sanitizeFeedback(state);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function recordDislikedBook(
  current: DislikedBookInput,
  existing: DiscoveryFeedbackState
): DiscoveryFeedbackState {
  const base = sanitizeFeedback(existing);

  const fingerprint =
    (current.fingerprint || '').trim().toLowerCase() ||
    getBookFingerprint(current.title, current.author);

  const author = (current.author || '').trim().toLowerCase();
  const titleTerms = extractTitleKeywords(current.title);

  return sanitizeFeedback({
    rejectedFingerprints: [...base.rejectedFingerprints, fingerprint],
    rejectedAuthors: author ? [...base.rejectedAuthors, author] : base.rejectedAuthors,
    rejectedTitleTerms: [...base.rejectedTitleTerms, ...titleTerms],
  });
}
