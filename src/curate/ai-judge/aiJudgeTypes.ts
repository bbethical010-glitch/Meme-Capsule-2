import type { CorpusStatus } from "../curateTypes";

export type AiProviderKey = "nvidia" | "openrouter" | "gemini" | "groq" | "custom";

export interface AiProviderPreset {
  id: AiProviderKey;
  name: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  description: string;
  keyHelpUrl: string;
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "nvidia",
    name: "NVIDIA NIM (Free Credits)",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.2-11b-vision-instruct",
    recommendedModels: [
      "meta/llama-3.2-11b-vision-instruct",
      "meta/muse-glimmer-30b",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      "microsoft/phi-3-vision-128k-instruct",
      "meta/llama-3.2-90b-vision-instruct"
    ],
    description: "NVIDIA hosted inference. 1,000 free API credits upon signup at build.nvidia.com.",
    keyHelpUrl: "https://build.nvidia.com"
  },
  {
    id: "gemini",
    name: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    recommendedModels: [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash-lite-preview-02-05"
    ],
    description: "Best-in-class pop culture, slang and meme context. Free tier 15 RPM. Compatible OpenAI endpoint.",
    keyHelpUrl: "https://aistudio.google.com/apikey"
  },
  {
    id: "groq",
    name: "Groq Cloud (Ultra Fast)",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.2-11b-vision-preview",
    recommendedModels: [
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview"
    ],
    description: "Sub-second LPU inference. Note: Groq strictly requires vision models (llama-3.2 vision) for image inputs.",
    keyHelpUrl: "https://console.groq.com/keys"
  },
  {
    id: "openrouter",
    name: "OpenRouter (Free & Community Models)",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    recommendedModels: [
      "google/gemini-2.0-flash-exp:free",
      "qwen/qwen-2.5-vl-72b-instruct:free",
      "meta-llama/llama-3.2-11b-vision-instruct:free",
      "moonshotai/kimi-k3"
    ],
    description: "Aggregator supporting free Gemini, Qwen-VL, Llama Vision, and Kimi K3.",
    keyHelpUrl: "https://openrouter.ai/keys"
  },
  {
    id: "custom",
    name: "Custom Base URL / Local Ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2-vision",
    recommendedModels: [
      "llama3.2-vision",
      "minicpm-v",
      "qwen2.5-vl",
      "muse-glimmer-30b"
    ],
    description: "Any OpenAI-compatible server (Local Ollama, vLLM, private endpoint).",
    keyHelpUrl: "http://localhost:11434"
  }
];

export interface JudgeAiPreset {
  id: string;
  user_id?: string;
  preset_name: string;
  provider: AiProviderKey;
  base_url: string;
  api_key: string;
  model: string;
  models: string[];
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AiJudgeConfig {
  provider: AiProviderKey;
  baseUrl: string;
  apiKey: string;
  model: string;
  useProxy: boolean;
  previewDelayMs: number; // e.g. 1500ms visual countdown pause
  batchMode: "endless" | "count";
  batchCount: number; // e.g. 25 memes
  lowConfidenceFallback: "excluded";
  confidenceThreshold: number; // e.g. 0.6
  activePresetId?: string | null;
  customInstructions?: string; // Pre-build batch instructions for AI judge
}

export const DEFAULT_AI_JUDGE_CONFIG: AiJudgeConfig = {
  provider: "nvidia",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  apiKey: "",
  model: "meta/llama-3.2-11b-vision-instruct",
  useProxy: true,
  previewDelayMs: 1500,
  batchMode: "endless",
  batchCount: 25,
  lowConfidenceFallback: "excluded",
  confidenceThreshold: 0.6,
  activePresetId: null,
  customInstructions: ""
};

export interface AiJudgeDecision {
  corpus_status: CorpusStatus;
  duplicate_of?: string | null;
  topics: string[];
  tone: string | null;
  humour_mechanisms: string[];
  curator_note: string;
  confidence: number;
  modelUsed?: string;
  latencyMs?: number;
}

export type AiJudgeLoopState =
  | "idle"
  | "analyzing"
  | "retrying"
  | "previewing"
  | "saving"
  | "paused"
  | "stopped"
  | "error";
