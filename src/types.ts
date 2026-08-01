export type Ecosystem = "pip" | "npm";

export interface PackageInfo {
  name: string;
  exists: boolean;
  ageDays: number | null;
  monthlyDownloads: number | null;
  hasSourceRepo: boolean;
}

export type Level = "allow" | "warn" | "block";

export interface Signal {
  id: string;
  reason: string;
  weight: number;
}

export interface CheckResult {
  ecosystem: Ecosystem;
  name: string;
  level: Level;
  score: number;
  signals: Signal[];
  alternatives: string[];
}
