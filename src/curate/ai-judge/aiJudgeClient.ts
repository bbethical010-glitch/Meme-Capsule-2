import type { CurateMemeItem } from "../curateTypes";
import {
  CURATION_TOPICS,
  CURATION_TONES,
  CURATION_MECHANISMS
} from "../curateTypes";
import type { AiJudgeConfig, AiJudgeDecision } from "./aiJudgeTypes";
import {
  buildAiJudgeSystemPrompt,
  buildAiJudgeUserPrompt,
  buildUnifiedAiJudgePrompt
} from "./aiJudgePrompt";

const VALID_STATUSES = new Set(["keep", "excluded", "duplicate"]);
const VALID_TOPICS = new Set(CURATION_TOPICS.map((t) => t.id));
const VALID_TONES = new Set(CURATION_TONES.map((t) => t.id));
const VALID_MECHS = new Set(CURATION_MECHANISMS.map((m) => m.id));

/**
 * Downsamples and compresses an image to a lightweight JPEG data URL (max 800px, ~80KB)
 * to eliminate downstream URL fetching delays and drastically cut vision model inference time.
 * Seamlessly resolves internal relative URLs (/api/curate/media/proxy) and falls back to Blob reader.
 */
export const prepareOptimizedImagePayload = async (imageUrl: string): Promise<string> => {
  if (!imageUrl || typeof window === "undefined") {
    return imageUrl || "";
  }

  // Resolve relative URLs (e.g. /api/curate/media/proxy?id=...) to absolute origin
  let resolvedUrl = imageUrl.trim();
  if (!resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://") && !resolvedUrl.startsWith("data:")) {
    const origin = window.location.origin.replace(/\/+$/, "");
    const cleanPath = resolvedUrl.startsWith("/") ? resolvedUrl : `/${resolvedUrl}`;
    resolvedUrl = `${origin}${cleanPath}`;
  }

  // If already a data URI, return as-is
  if (resolvedUrl.startsWith("data:")) {
    return resolvedUrl;
  }

  const fetchBlobAsDataUrl = async (url: string): Promise<string> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const blob = await res.blob();
      return await new Promise<string>((resBlob, rejBlob) => {
        const reader = new FileReader();
        reader.onloadend = () => resBlob((reader.result as string) || url);
        reader.onerror = rejBlob;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(resolvedUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl);
      } catch {
        fetchBlobAsDataUrl(resolvedUrl).then(resolve).catch(() => resolve(resolvedUrl));
      }
    };
    img.onerror = () => {
      fetchBlobAsDataUrl(resolvedUrl).then(resolve).catch(() => resolve(resolvedUrl));
    };
    img.src = resolvedUrl;
  });
};

/**
 * Universal Hybrid Curation Extractor:
 * 1. Parses standard JSON if present.
 * 2. Parses Markdown key-value pairs (e.g. **Corpus Status:** keep) with regex.
 * 3. Uses conversational and keyword heuristics if freeform text is returned.
 * NEVER throws an error if the model returned readable text!
 */
export const extractHybridCurationResult = (rawText: string): Record<string, unknown> => {
  const cleaned = (rawText || "").trim();

  // Step 1: Standard JSON parsing
  try {
    let jsonStr = cleaned;
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = jsonStr.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    }
  } catch {
    // Continue to Step 2
  }

  // Step 2: Markdown & Key-Value extraction
  const extractField = (patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const match = cleaned.match(p);
      if (match && match[1]) {
        return match[1].trim().replace(/^[*_`"']+|[*_`"']+$/g, "").trim();
      }
    }
    return null;
  };

  const statusMatch = extractField([
    /(?:corpus_status|corpus status|status|decision)\s*[:=]\s*[*_`"']*([a-zA-Z_]+)/i,
    /\*\*([a-zA-Z_]+)\*\*\s*(?:corpus_status|status|decision)/i
  ]);

  let corpusStatus = "keep";
  if (statusMatch) {
    const s = statusMatch.toLowerCase();
    if (s.includes("exclude")) corpusStatus = "excluded";
    else if (s.includes("dup")) corpusStatus = "duplicate";
    else corpusStatus = "keep";
  } else {
    // Step 3: Conversational cues
    const lower = cleaned.toLowerCase();
    if (lower.includes("watermark") || lower.includes("not a meme") || lower.includes("exclude")) {
      corpusStatus = "excluded";
    }
  }

  // Extract topics
  const topicsRaw = extractField([
    /(?:topics?|categories?)\s*[:=]\s*([^\n\r]+)/i
  ]);
  const topics: string[] = [];
  if (topicsRaw) {
    for (const t of CURATION_TOPICS) {
      if (topicsRaw.toLowerCase().includes(t.id.toLowerCase())) {
        topics.push(t.id);
      }
    }
  }
  if (topics.length === 0) {
    for (const t of CURATION_TOPICS) {
      if (cleaned.toLowerCase().includes(t.id.toLowerCase())) {
        topics.push(t.id);
        if (topics.length >= 2) break;
      }
    }
  }

  // Extract tone
  const toneRaw = extractField([
    /(?:dominant_tone|dominant tone|tone)\s*[:=]\s*[*_`"']*([a-zA-Z]+)/i
  ]);
  let tone = "Neutral";
  if (toneRaw) {
    for (const tn of CURATION_TONES) {
      if (toneRaw.toLowerCase().includes(tn.id.toLowerCase())) {
        tone = tn.id;
        break;
      }
    }
  } else {
    for (const tn of CURATION_TONES) {
      if (cleaned.toLowerCase().includes(tn.id.toLowerCase())) {
        tone = tn.id;
        break;
      }
    }
  }

  // Extract mechanisms
  const mechRaw = extractField([
    /(?:humour_mechanisms?|humor_mechanisms?|mechanisms?)\s*[:=]\s*([^\n\r]+)/i
  ]);
  const mechanisms: string[] = [];
  if (mechRaw) {
    for (const m of CURATION_MECHANISMS) {
      if (mechRaw.toLowerCase().includes(m.id.toLowerCase())) {
        mechanisms.push(m.id);
      }
    }
  }
  if (mechanisms.length === 0) {
    for (const m of CURATION_MECHANISMS) {
      if (cleaned.toLowerCase().includes(m.id.toLowerCase())) {
        mechanisms.push(m.id);
        if (mechanisms.length >= 2) break;
      }
    }
  }

  // Extract curator note / reasoning
  const noteRaw = extractField([
    /(?:curator_note|curator note|rationale|note|explanation|reasoning)\s*[:=]\s*[*_`"']*([^\n\r]+)/i
  ]);
  let curatorNote = noteRaw || "";
  if (!curatorNote) {
    const candidate = cleaned
      .replace(/[*_#`]/g, "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 15 && !l.includes(":") && !l.toLowerCase().startsWith("meme analysis"));
    curatorNote = candidate ? candidate.slice(0, 180) : "Automated AI curation analysis";
  }

  // Extract confidence
  const confRaw = extractField([
    /(?:confidence)\s*[:=]\s*[*_`"']*([0-9.]+)/i
  ]);
  let confidence = confRaw ? parseFloat(confRaw) : 0.88;
  if (isNaN(confidence)) confidence = 0.88;
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100;

  return {
    corpus_status: corpusStatus,
    duplicate_of: null,
    topics: topics.length > 0 ? topics : ["Everyday Life"],
    tone: tone,
    humour_mechanisms: mechanisms.length > 0 ? mechanisms : ["Relatability"],
    curator_note: curatorNote,
    confidence: Math.min(1, Math.max(0, confidence))
  };
};

export const extractJsonFromText = extractHybridCurationResult;

// Session caches for model capabilities to avoid repeated 501/400 failures and redundant round-trips
const unsupportedJsonModeModels = new Set<string>();
const unsupportedSystemRoleModels = new Set<string>();

const getModelCacheKey = (config: AiJudgeConfig): string =>
  `${config.provider}:${config.model}`.toLowerCase();

/**
 * Robustly normalizes API base URLs and endpoints across diverse AI providers,
 * preventing duplicate /chat/completions/chat/completions, wrong API versions (e.g. /v11),
 * or missing OpenAI-compatible compatibility paths (HTTP 404).
 */
export const resolveChatEndpoint = (baseUrl: string): string => {
  let url = (baseUrl || "").trim();
  if (!url) return "";

  // Normalize duplicate slashes except after http(s):
  url = url.replace(/([^:])\/\/+/g, "$1/");

  const lower = url.toLowerCase();

  // Google AI Studio OpenAI-compatible endpoint
  if (lower.includes("generativelanguage.googleapis.com")) {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }

  // Groq Cloud OpenAI-compatible endpoint
  if (lower.includes("groq.com")) {
    return "https://api.groq.com/openai/v1/chat/completions";
  }

  // If already a full chat completions endpoint
  if (url.endsWith("/chat/completions")) {
    return url;
  }
  if (url.endsWith("/chat")) {
    return `${url}/completions`;
  }

  // Handle provider base URL shorthand patterns
  if (lower.includes("integrate.api.nvidia.com") && !lower.includes("/v1")) {
    url = `${url.replace(/\/+$/, "")}/v1`;
  } else if (lower.includes("openrouter.ai") && !lower.includes("/api/v1")) {
    url = lower.includes("/api") ? `${url.replace(/\/+$/, "")}/v1` : `${url.replace(/\/+$/, "")}/api/v1`;
  }

  return `${url.replace(/\/+$/, "")}/chat/completions`;
};

/**
 * Execute a completion call either directly or via the Cloudflare CORS proxy.
 */
export const postCompletion = async (
  config: AiJudgeConfig,
  body: Record<string, unknown>
): Promise<any> => {
  const endpoint = resolveChatEndpoint(config.baseUrl);

  if (config.useProxy) {
    const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("curator_token") : null;
    const proxyHeaders: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      proxyHeaders["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch("/api/curate/ai-proxy", {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify({
        endpoint,
        apiKey: config.apiKey,
        presetId: config.activePresetId,
        body
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let errDetail =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || data.message || `Proxy failed with HTTP ${res.status}`;

      if (endpoint.includes("generativelanguage.googleapis.com") && (res.status === 404 || errDetail.includes("not found"))) {
        errDetail = `Google AI Studio error: Model "${config.model}" not found or endpoint invalid. Please use a valid model name (e.g. 'gemini-2.0-flash' or 'gemini-1.5-flash').`;
      } else if (endpoint.includes("groq.com") && errDetail.includes("content must be a string")) {
        errDetail = `Groq error: Model "${config.model}" does not support vision/images. Please use 'llama-3.2-11b-vision-preview' or 'llama-3.2-90b-vision-preview'.`;
      }

      throw new Error(errDetail);
    }
    return data;
  }

  // Direct browser-to-API call
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
    if (endpoint.includes("generativelanguage.googleapis.com")) {
      headers["x-goog-api-key"] = config.apiKey;
    }
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let errDetail = data.error?.message || data.error || `API returned HTTP ${res.status}`;
    if (endpoint.includes("generativelanguage.googleapis.com") && (res.status === 404 || errDetail.includes("not found"))) {
      errDetail = `Google AI Studio error: Model "${config.model}" not found. Valid models include 'gemini-2.0-flash' and 'gemini-1.5-flash'.`;
    } else if (endpoint.includes("groq.com") && errDetail.includes("content must be a string")) {
      errDetail = `Groq error: Model "${config.model}" does not support images. Please use 'llama-3.2-11b-vision-preview'.`;
    }
    throw new Error(errDetail);
  }
  return data;
};

/**
 * Test API connection and credentials with a small fast text prompt.
 */
export const testAiConnection = async (config: AiJudgeConfig): Promise<{ success: boolean; message: string }> => {
  if (!config.baseUrl.trim()) {
    return { success: false, message: "Base URL is required." };
  }

  try {
    const payload = {
      model: config.model,
      messages: [
        { role: "user", content: "Reply with the single word OK." }
      ],
      max_tokens: 150 // Reasoning models (Muse, Kimi) require adequate token budget for thinking tokens
    };

    const data = await postCompletion(config, payload);
    const choice = data?.choices?.[0];
    const content = (
      choice?.message?.content ||
      choice?.message?.reasoning_content ||
      choice?.text ||
      ""
    ).trim();

    if (content) {
      return { success: true, message: `Connected to ${config.model} successfully!` };
    }
    return { success: false, message: "Received empty response from model." };
  } catch (err: unknown) {
    let msg = err instanceof Error ? err.message : "Connection failed.";
    if (msg.includes("timed out") || msg.includes("aborted")) {
      msg = `Model request timed out (${config.model.split("/").pop()}). Large (90B) or reasoning models can take 30+ seconds to respond on free/shared tiers. Please retry, or use a faster vision model like 11B or Phi-3.`;
    }
    return {
      success: false,
      message: msg
    };
  }
};

/**
 * Universal Vision Model Analysis with Adaptive Fallback & Memory:
 * 1. Automatically checks feature memory to bypass doomed response_format calls (preventing 501/400 errors).
 * 2. Tries standard structured output mode if supported.
 * 3. If rejected due to 501, 400, response_format, or system message restrictions,
 *    remembers this capability and seamlessly falls back to universal adaptive payload.
 * 4. Uses outermost JSON extraction to reliably parse conversational model outputs.
 */
export const analyzeMemeWithAi = async (
  meme: CurateMemeItem,
  config: AiJudgeConfig
): Promise<AiJudgeDecision> => {
  const startTime = Date.now();
  const cacheKey = getModelCacheKey(config);

  const isReasoningModel =
    config.model.toLowerCase().includes("muse") ||
    config.model.toLowerCase().includes("glimmer") ||
    config.model.toLowerCase().includes("kimi") ||
    config.model.toLowerCase().includes("reasoning") ||
    config.model.toLowerCase().includes("think");

  // Models that don't support response_format or already failed with 501/400 in this session
  const jsonModeDisabled = isReasoningModel || unsupportedJsonModeModels.has(cacheKey);
  const systemRoleDisabled = unsupportedSystemRoleModels.has(cacheKey);

  // Downscale and compress image to lightweight base64 to eliminate downstream URL fetching latency
  const optimizedUrl = await prepareOptimizedImagePayload(meme.image_url);
  const imagePayload: Record<string, unknown> = {
    url: optimizedUrl
  };
  if (
    config.provider === "openrouter" ||
    config.provider === "gemini" ||
    config.baseUrl.toLowerCase().includes("openrouter") ||
    config.baseUrl.toLowerCase().includes("openai")
  ) {
    imagePayload["detail"] = "low";
  }

  const tokenLimit = isReasoningModel ? 500 : 380;

  const buildMessages = (useUnifiedPrompt: boolean) => {
    if (useUnifiedPrompt || systemRoleDisabled) {
      return [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildUnifiedAiJudgePrompt(meme.title, meme.id, config.customInstructions)
            },
            {
              type: "image_url",
              image_url: imagePayload
            }
          ]
        }
      ];
    }

    return [
      {
        role: "system",
        content: buildAiJudgeSystemPrompt(config.customInstructions)
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildAiJudgeUserPrompt(meme.title, meme.id)
          },
          {
            type: "image_url",
            image_url: imagePayload
          }
        ]
      }
    ];
  };

  const standardPayload: Record<string, unknown> = {
    model: config.model,
    messages: buildMessages(false),
    temperature: 0.1,
    max_tokens: tokenLimit
  };

  if (!jsonModeDisabled) {
    standardPayload["response_format"] = { type: "json_object" };
  }

  let data: any;
  try {
    // Attempt 1: Fast inference request (direct or memory-adapted)
    data = await postCompletion(config, standardPayload);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

    // Check if error is related to response_format, unsupported parameters, 501 Not Implemented, or 400/422 Bad Request
    const isFormatOr501Error =
      errMsg.includes("501") ||
      errMsg.includes("not implemented") ||
      errMsg.includes("response_format") ||
      errMsg.includes("json_object") ||
      errMsg.includes("schema") ||
      errMsg.includes("unexpected") ||
      errMsg.includes("extra inputs") ||
      errMsg.includes("not supported") ||
      errMsg.includes("400") ||
      errMsg.includes("422") ||
      errMsg.includes("bad request");

    const isSystemError = errMsg.includes("system") || errMsg.includes("role");

    if (isFormatOr501Error || isSystemError) {
      // Remember capability failure to avoid repeating failed round trips in future memes
      if (isFormatOr501Error) {
        unsupportedJsonModeModels.add(cacheKey);
      }
      if (isSystemError) {
        unsupportedSystemRoleModels.add(cacheKey);
      }

      // Attempt 2: Universal Adaptive Fallback without response_format and unified prompt if needed
      const fallbackPayload: Record<string, unknown> = {
        model: config.model,
        messages: buildMessages(true),
        temperature: 0.1,
        max_tokens: isReasoningModel ? 600 : 450
      };

      data = await postCompletion(config, fallbackPayload);
    } else {
      throw err;
    }
  }

  const latencyMs = Date.now() - startTime;
  const choice = data?.choices?.[0];
  const rawContent = (
    choice?.message?.content ||
    choice?.message?.reasoning_content ||
    choice?.text ||
    ""
  ).trim();

  if (!rawContent) {
    throw new Error("Model returned empty or invalid response content.");
  }

  // Parse with Universal Hybrid Extractor (seamlessly extracts JSON, Markdown key-values, or conversational text)
  const parsed = extractHybridCurationResult(rawContent);

  // Sanitize and normalize classification fields
  let corpusStatus = String(parsed.corpus_status || "keep").toLowerCase();
  if (!VALID_STATUSES.has(corpusStatus)) {
    corpusStatus = "keep";
  }

  // Filter topics (must be within CURATION_TOPICS, max 3)
  const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
  const validTopics = rawTopics
    .map((t: unknown) => String(t).trim())
    .filter((t: string) => VALID_TOPICS.has(t as any))
    .slice(0, 3);

  // Filter tone (must be in CURATION_TONES, exactly 1)
  let tone: string | null = parsed.tone ? String(parsed.tone).trim() : null;
  if (tone && !VALID_TONES.has(tone as any)) {
    tone = "Neutral";
  }

  // Filter mechanisms (must be in CURATION_MECHANISMS, max 2)
  const rawMechs = Array.isArray(parsed.humour_mechanisms) ? parsed.humour_mechanisms : [];
  const validMechs = rawMechs
    .map((m: unknown) => String(m).trim())
    .filter((m: string) => VALID_MECHS.has(m as any))
    .slice(0, 2);

  const confidence =
    typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.85;

  // Apply low-confidence fallback if score is below threshold
  if (confidence < config.confidenceThreshold) {
    corpusStatus = config.lowConfidenceFallback;
  }

  const curatorNote = parsed.curator_note
    ? String(parsed.curator_note).trim()
    : "Automated AI curation";

  return {
    corpus_status: corpusStatus as any,
    duplicate_of: parsed.duplicate_of ? String(parsed.duplicate_of) : null,
    topics: validTopics.length > 0 ? validTopics : ["Everyday Life"],
    tone: tone || "Neutral",
    humour_mechanisms: validMechs.length > 0 ? validMechs : ["Relatability"],
    curator_note: curatorNote,
    confidence,
    modelUsed: config.model,
    latencyMs
  };
};
