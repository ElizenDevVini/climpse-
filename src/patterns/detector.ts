import type { ActivityEntry } from '../observer/activity.js';

export interface DetectedSequence {
  steps: SequenceStep[];
  occurrences: number;
  averageTime: string;
  timeRange: { start: string; end: string };
  firstSeen: string;
  lastSeen: string;
}

export interface SequenceStep {
  app_name: string;
  window_title: string;
  url?: string;
}

/**
 * Finds repeated sequences of app switches in activity data.
 *
 * Segments the activity stream into sessions (based on time gaps),
 * collapses consecutive same-app entries, then searches for
 * sequences that repeat across multiple sessions.
 */
export class PatternDetector {
  private minOccurrences: number;
  private minSequenceLength: number;
  private maxSequenceLength: number;
  private sessionGapMs: number;

  constructor(
    minOccurrences: number = 3,
    minSequenceLength: number = 2,
    maxSequenceLength: number = 10,
    sessionGapMinutes: number = 30
  ) {
    this.minOccurrences = minOccurrences;
    this.minSequenceLength = minSequenceLength;
    this.maxSequenceLength = maxSequenceLength;
    this.sessionGapMs = sessionGapMinutes * 60 * 1000;
  }

  detect(entries: ActivityEntry[]): DetectedSequence[] {
    if (entries.length < this.minSequenceLength) {
      return [];
    }

    // Split into sessions, then collapse each session
    const sessions = this.splitIntoSessions(entries);
    const collapsedSessions = sessions.map(s => this.collapseConsecutive(s));

    // Extract candidate sequences from each session
    const candidateMap = new Map<string, { sequence: ActivityEntry[]; positions: { session: number; index: number }[] }>();

    for (let si = 0; si < collapsedSessions.length; si++) {
      const session = collapsedSessions[si];
      for (let len = this.minSequenceLength; len <= Math.min(this.maxSequenceLength, session.length); len++) {
        for (let i = 0; i <= session.length - len; i++) {
          const candidate = session.slice(i, i + len);
          const key = this.sequenceKey(candidate);

          if (!candidateMap.has(key)) {
            candidateMap.set(key, { sequence: candidate, positions: [] });
          }
          candidateMap.get(key)!.positions.push({ session: si, index: i });
        }
      }
    }

    // Find candidates that appear in enough *distinct sessions*
    const sequences: DetectedSequence[] = [];

    for (const [, value] of candidateMap) {
      const distinctSessions = new Set(value.positions.map(p => p.session));
      if (distinctSessions.size < this.minOccurrences) continue;

      const times = value.positions.map(p => {
        const entry = collapsedSessions[p.session][p.index];
        return new Date(entry.timestamp).getHours();
      });

      const avgHour = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const minHour = Math.min(...times);
      const maxHour = Math.max(...times);

      const firstPos = value.positions[0];
      const lastPos = value.positions[value.positions.length - 1];

      sequences.push({
        steps: value.sequence.map(e => ({
          app_name: e.app_name,
          window_title: e.window_title,
          url: e.url,
        })),
        occurrences: distinctSessions.size,
        averageTime: `${avgHour.toString().padStart(2, '0')}:00`,
        timeRange: {
          start: `${minHour.toString().padStart(2, '0')}:00`,
          end: `${maxHour.toString().padStart(2, '0')}:59`,
        },
        firstSeen: collapsedSessions[firstPos.session][firstPos.index].timestamp,
        lastSeen: collapsedSessions[lastPos.session][lastPos.index].timestamp,
      });
    }

    // Remove subsequences (prefer longer patterns)
    return this.filterSubsequences(sequences);
  }

  private splitIntoSessions(entries: ActivityEntry[]): ActivityEntry[][] {
    if (entries.length === 0) return [];

    const sessions: ActivityEntry[][] = [[]];
    let currentSession = sessions[0];

    for (let i = 0; i < entries.length; i++) {
      if (i > 0) {
        const prevTime = new Date(entries[i - 1].timestamp).getTime();
        const currTime = new Date(entries[i].timestamp).getTime();
        if (currTime - prevTime > this.sessionGapMs) {
          currentSession = [];
          sessions.push(currentSession);
        }
      }
      currentSession.push(entries[i]);
    }

    return sessions.filter(s => s.length > 0);
  }

  private collapseConsecutive(entries: ActivityEntry[]): ActivityEntry[] {
    const collapsed: ActivityEntry[] = [];
    let lastApp = '';

    for (const entry of entries) {
      if (entry.app_name !== lastApp) {
        collapsed.push(entry);
        lastApp = entry.app_name;
      }
    }

    return collapsed;
  }

  private sequenceKey(entries: ActivityEntry[]): string {
    return entries.map(e => this.normalizeAppName(e.app_name)).join('→');
  }

  private normalizeAppName(name: string): string {
    return name.toLowerCase().trim();
  }

  private filterSubsequences(sequences: DetectedSequence[]): DetectedSequence[] {
    // Sort by length descending, then by occurrences descending
    const sorted = [...sequences].sort((a, b) => {
      if (b.steps.length !== a.steps.length) return b.steps.length - a.steps.length;
      return b.occurrences - a.occurrences;
    });

    const result: DetectedSequence[] = [];
    const coveredKeys = new Set<string>();

    for (const seq of sorted) {
      const key = seq.steps.map(s => this.normalizeAppName(s.app_name)).join('→');

      // Check if this is a subsequence of an already-included pattern
      let isSubsequence = false;
      for (const covered of coveredKeys) {
        if (covered.includes(key)) {
          isSubsequence = true;
          break;
        }
      }

      if (!isSubsequence) {
        result.push(seq);
        coveredKeys.add(key);
      }
    }

    return result;
  }
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching window titles.
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two strings are similar enough (fuzzy match).
 */
export function isSimilar(a: string, b: string, threshold: number = 0.7): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen >= threshold;
}
