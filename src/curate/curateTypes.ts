/**
 * Multi-Dimensional Taxonomy & Curation Types
 */

export const CURATION_TOPICS = [
  { id: "Everyday Life",       key: "1", label: "Everyday Life" },
  { id: "Work / Education",    key: "2", label: "Work / Education" },
  { id: "Relationships",       key: "3", label: "Relationships" },
  { id: "Family",              key: "4", label: "Family" },
  { id: "Politics / Society",  key: "5", label: "Politics / Society" },
  { id: "Internet Culture",    key: "6", label: "Internet Culture" },
  { id: "Pop Culture",         key: "7", label: "Pop Culture" },
  { id: "Gaming",              key: "8", label: "Gaming" },
  { id: "Animals",             key: "9", label: "Animals" },
  { id: "Food",                key: "0", label: "Food" },
  { id: "Technology",          key: "-", label: "Technology" },
  { id: "Other",               key: "=", label: "Other" }
] as const;

export const CURATION_TONES = [
  { id: "Wholesome", key: "Q", label: "Wholesome", color: "#34C759" },
  { id: "Dark",      key: "W", label: "Dark",      color: "#dd0061" },
  { id: "Chaotic",   key: "E", label: "Chaotic",   color: "#FF9F0A" },
  { id: "Cynical",   key: "A", label: "Cynical",   color: "#9b30ff" },
  { id: "Awkward",   key: "S", label: "Awkward",   color: "#f4c300" },
  { id: "Neutral",   key: "F", label: "Neutral",   color: "#5AC8FA" }
] as const;

export const CURATION_MECHANISMS = [
  { id: "Relatability", key: "Z", label: "Relatability" },
  { id: "Absurdity",    key: "C", label: "Absurdity" },
  { id: "Irony",        key: "V", label: "Irony" },
  { id: "Satire",       key: "B", label: "Satire" },
  { id: "Exaggeration", key: "N", label: "Exaggeration" },
  { id: "Cringe",       key: "M", label: "Cringe" },
  { id: "Dark Humour",  key: "J", label: "Dark Humour" },
  { id: "Parody",       key: "P", label: "Parody" },
  { id: "Surrealism",   key: "O", label: "Surrealism" }
] as const;

export type CorpusStatus = "keep" | "excluded" | "duplicate" | "review_later";

export interface CuratorUser {
  id: string;
  username: string;
  display_name: string;
  role: "judge" | "superadmin";
  has_api_password?: boolean;
}

export interface CuratedMemeData {
  corpus_status: CorpusStatus;
  duplicate_of?: string | null;
  topics: string[];
  tone?: string | null;
  humour_mechanisms: string[];
  curator_note?: string | null;
  user_id?: string;
  user_name?: string;
  reviewed_at?: string;
  updated_at?: string;
}

export interface CurateMemeItem {
  id: string;
  title: string;
  image_url: string;
  storage_path: string;
  is_nsfw?: boolean | number;
  nsfw_flagged_by?: "ai-judge" | "curator" | "report" | string | null;
  curation?: CuratedMemeData | null;
  ai_prediction?: {
    corpus_status: CorpusStatus | null;
    topics: string[];
    tone: string | null;
    humour_mechanisms: string[];
    confidence: number;
    reasoning: string | null;
    model: string | null;
    tokens_used: number;
    processing_ms: number;
    error: string | null;
    updated_at: string | null;
  } | null;
  ai_judgements?: {
    judge4?: CuratedMemeData | null;
    judge5?: CuratedMemeData | null;
  };
}

export interface CurationCounts {
  total: number;
  reviewed: number;
  remaining: number;
  kept: number;
  excluded: number;
  duplicates: number;
  review_later: number;
  percent_complete: number;
}

export interface CurationStatsResponse {
  counts: CurationCounts;
  user_progress?: {
    user_id: string;
    display_name: string;
    reviewed: number;
    kept: number;
    excluded: number;
    duplicates: number;
    review_later: number;
  }[];
  distributions: {
    topics: { topic: string; count: number; percent: number }[];
    tones: { tone: string; count: number; percent: number }[];
    humour_mechanisms: { mechanism: string; count: number; percent: number }[];
  };
}
