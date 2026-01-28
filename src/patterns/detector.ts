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
 * Uses a simplified longest-common-subsequence approach with
 * fuzzy matching on window titles.
 */
export class PatternDetector {
  private minOccurrences: number;
  private minSequenceLength: number;
  private maxSequenceLength: number;

  constructor(
    minOccurrences: number = 3,
    minSequenceLength: number = 2,
    maxSequenceLength: number = 10
  ) {
    this.minOccurrences = minOccurrences;
    this.minSequenceLength = minSequenceLength;
    this.maxSequenceLength = maxSequenceLength;
  }

  detect(entries: ActivityEntry[]): DetectedSequence[] {
    // Collapse consecutive entries with the same app into a single step
    const collapsed = this.collapseConsecutive(entries);

    if (collapsed.length < this.minSequenceLength * this.minOccurrences) {
      return [];
    }

    const sequences: DetectedSequence[] = [];
    const seen = new Set<string>();

    // Sliding window: try different sequence lengths
    for (let len = this.minSequenceLength; len <= this.maxSequenceLength; len++) {
      for (let i = 0; i <= collapsed.length - len; i++) {
        const candidate = collapsed.slice(i, i + len);
        const key = this.sequenceKey(candidate);

        if (seen.has(key)) continue;
        seen.add(key);

        // Count fuzzy occurrences of this sequence
        const matches = this.findOccurrences(collapsed, candidate);

        if (matches.length >= this.minOccurrences) {
          const times = matches.map(m => {
            const hour = new Date(collapsed[m].timestamp).getHours();
            return hour;
          });

          const avgHour = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          const minHour = Math.min(...times);
          const maxHour = Math.max(...times);

          sequences.push({
            steps: candidate.map(e => ({
              app_name: e.app_name,
              window_title: e.window_title,
              url: e.url,
            })),
            occurrences: matches.length,
            averageTime: `${avgHour.toString().padStart(2, '0')}:00`,
            timeRange: {
              start: `${minHour.toString().padStart(2, '0')}:00`,
              end: `${maxHour.toString().padStart(2, '0')}:59`,
            },
            firstSeen: collapsed[matches[0]].timestamp,
            lastSeen: collapsed[matches[matches.length - 1]].timestamp,
          });
        }
      }
    }

    // Remove subsequences (prefer longer patterns)
    return this.filterSubsequences(sequences);
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

  private matchStep(a: ActivityEntry, b: ActivityEntry): boolean {
    return this.normalizeAppName(a.app_name) === this.normalizeAppName(b.app_name);
  }

  private findOccurrences(
    haystack: ActivityEntry[],
    needle: ActivityEntry[]
  ): number[] {
    const matches: number[] = [];

    for (let i = 0; i <= haystack.length - needle.length; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (!this.matchStep(haystack[i + j], needle[j])) {
          match = false;
          break;
        }
      }
      if (match) {
        matches.push(i);
        // Skip ahead to avoid overlapping matches
        // But don't skip too far — allow some overlap for daily patterns
      }
    }

    return matches;
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
