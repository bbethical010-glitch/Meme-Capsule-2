export type EditorTool =
  | "select"
  | "crop"
  | "blur"
  | "mosaic"
  | "brush"
  | "rectangle"
  | "circle"
  | "text";

export type BlurRegion = {
  id: string;
  type: "blur" | "mosaic";
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number; // e.g. 5-30 for blur radius or block size
};

export type DrawLine = {
  id: string;
  tool: "brush";
  points: number[];
  color: string;
  strokeWidth: number;
};

export type ShapeAnnotation = {
  id: string;
  type: "rectangle" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill?: string;
};

export type TextAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontFamily: string;
  stroke?: string;
  strokeWidth?: number;
};

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EditorState = {
  rotation: number; // 0, 90, 180, 270
  crop: CropRect | null;
  blurRegions: BlurRegion[];
  lines: DrawLine[];
  shapes: ShapeAnnotation[];
  texts: TextAnnotation[];
};

export type MediaOperationRecord = {
  operation_id: string;
  meme_id: string;
  actor_id: string;
  actor_name: string;
  old_storage_path: string;
  new_storage_path: string;
  expected_storage_path: string;
  state: "pending" | "applied" | "cleanup_completed" | "stale_rejected";
  created_at: string;
};

