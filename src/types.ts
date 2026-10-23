export type Rarity = "Common" | "Rare" | "Legendary";
export type MemeStatus = "active" | "draft" | "archived";
export type MemeMediaType = "image" | "video";
export type MemeInputMethod = "url" | "upload" | "google-drive" | "seed";

export type Meme = {
  id: string;
  title?: string;
  url: string;
  storage_path?: string;
  category: string;
  tags: string[];
  rarity: Rarity;
  uploaded_at: string;
  share_text: string;
  rights_note?: string;
  source_link?: string;
  status?: MemeStatus;
  curation_status?: "keep" | "excluded" | "duplicate" | "review_later" | null;
  media_type?: MemeMediaType;
  input_method?: MemeInputMethod;
  likes_count?: number;
  is_nsfw?: number | boolean;
  nsfw_flagged_by?: "ai-judge" | "curator" | "report" | string | null;
};
