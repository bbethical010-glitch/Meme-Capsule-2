export const CORPUS_STATES = ["draft", "archive", "active", "excluded", "conflict"] as const;
export type CorpusState = typeof CORPUS_STATES[number];

export const VOTE_OPTIONS = ["keep", "excluded", "duplicate"] as const;
export type VoteDecision = typeof VOTE_OPTIONS[number];

export const STATE_METADATA: Record<CorpusState, { label: string; color: string; description: string }> = {
  draft: {
    label: "DRAFT",
    color: "#8e8e93",
    description: "New memes from any intake route. Not AI-reviewed."
  },
  archive: {
    label: "ARCHIVE",
    color: "#f4c300",
    description: "AI Judge review succeeded; waiting for human judge votes."
  },
  active: {
    label: "ACTIVE",
    color: "#34c759",
    description: "Human consensus Keep. Served to mobile app."
  },
  excluded: {
    label: "EXCLUDED",
    color: "#ff3b30",
    description: "Consensus Exclude (2:1) or Duplicate majority. Kept 7 days before purge."
  },
  conflict: {
    label: "CONFLICT",
    color: "#ff9500",
    description: "True 1:1:1 split across judges. Awaiting superadmin arbitration."
  }
};

export const LEGAL_TRANSITIONS: Record<CorpusState, readonly (CorpusState | "purged")[]> = {
  draft: ["archive", "purged"],
  archive: ["active", "excluded", "conflict", "purged"],
  active: ["purged"],
  conflict: ["active", "excluded", "purged"],
  excluded: ["active", "conflict", "excluded", "purged"]
};

export interface CorpusSummaryResponse {
  draft: number;
  archive: number;
  active: number;
  conflict: number;
  excluded: number;
  total: number;
  integrity: {
    ok: boolean;
    rows_in_table: number;
    sum_of_states: number;
  };
  last_maintenance_at: string;
  judges: Array<{
    name: string;
    reviewed: number;
    keep: number;
    exclude: number;
    duplicate: number;
    queue_left: number;
  }>;
  ai_judge: {
    judged: number;
  };
}
