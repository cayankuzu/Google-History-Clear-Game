export type SearchCategory =
  | "adult"
  | "relationship"
  | "family"
  | "crime"
  | "money"
  | "health"
  | "religion"
  | "paranormal"
  | "embarrassing"
  | "sad"
  | "betrayal"
  | "normal"
  | "wholesome"
  | "absurd";

export interface SearchHistoryCard {
  id: string;
  text: string;
  categories: SearchCategory[];
  severity: 1 | 2 | 3 | 4 | 5;
  context?: string;
}

export type AppScreen =
  | "start"
  | "crash"
  | "unlock"
  | "game"
  | "result"
  | "submit"
  | "admin";

export interface GameResult {
  deleted: SearchHistoryCard[];
  kept: SearchHistoryCard[];
  unprocessed: SearchHistoryCard[];
  elapsedMs: number;
}

export interface EndingResult {
  title: string;
  epitaph: string;
  story: string[];
  highlights: SearchHistoryCard[];
  score: number;
  scoreRange: string;
  breakdown: ScoreBreakdown;
}

export interface GameSettings {
  sound: boolean;
}

export interface ScoreBreakdown {
  goodKept: number;
  badDeleted: number;
  goodDeleted: number;
  badRemaining: number;
  riskyCardsInRound: number;
  safeCardsInRound: number;
  roundScoreCeiling: number;
  decisionAccuracy: number;
}

export interface CommunitySearch {
  id: string;
  text: string;
  category: SearchCategory;
  createdAt: string;
}

export interface AdminSubmission extends CommunitySearch {
  ip: string;
  deviceId: string;
  source: "seed" | "community";
  status: "active" | "hidden";
  updatedAt: string;
}

export interface IpBan {
  ip: string;
  deviceId: string;
  reason: string;
  createdAt: string;
}

export interface ScoreEntry {
  id: string;
  username: string;
  score: number;
  title: string;
  createdAt: string;
}

export interface AdminScoreEntry extends ScoreEntry {
  ip: string;
  deviceId: string;
  updatedAt: string;
}

export interface ScoreSubmissionResult {
  entry: ScoreEntry;
  rank: number;
  total: number;
}

export interface AuditLog {
  id: string;
  action: string;
  target: string;
  summary: string;
  createdAt: string;
}
