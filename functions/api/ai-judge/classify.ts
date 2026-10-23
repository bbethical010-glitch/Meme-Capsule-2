import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAiJudgeAuth } from "../../_shared/aiJudgeAuth";
import { encryptApiKey, decryptApiKey } from "../../_shared/crypto";

const TOPICS = ["Everyday Life", "Work / Education", "Relationships", "Family", "Politics / Society", "Internet Culture", "Pop Culture", "Gaming", "Animals", "Food", "Technology", "Other"];
const TONES = ["Wholesome", "Dark", "Chaotic", "Cynical", "Awkward", "Neutral"];
const MECHANISMS = ["Relatability", "Absurdity", "Irony", "Satire", "Exaggeration", "Cringe", "Dark Humour", "Parody", "Surrealism"];
const DECISIONS = ["keep", "excluded", "duplicate", "review_later"];

interface Payload { run_id?: string; meme_id?: string; image_url?: string; is_nsfw?: boolean | number }
interface Config { provider: "nvidia" | "openai"; model: string; api_key: string; max_retries: number; temperature: number }
interface Result { topics: string[]; tone: string; humour_mechanisms: string[]; decision: string; confidence: number; reasoning: string; is_nsfw?: boolean }

const buildPrompt = () => `You are an AI meme judge. Analyse the meme image and classify it using exactly this taxonomy.
TOPICS: ${TOPICS.join(", ")}
TONE: ${TONES.join(", ")}
HUMOUR MECHANISMS: ${MECHANISMS.join(", ")}
DECISION: keep, excluded, duplicate, or review_later.
NSFW / TOXICITY: Indicate if the content is NSFW, sexually suggestive, graphic, or toxic (is_nsfw: true/false).
Respond with only JSON: {"topics":["Everyday Life"],"tone":"Neutral","humour_mechanisms":["Relatability"],"decision":"keep","confidence":0.85,"reasoning":"One short sentence.","is_nsfw":false}
Use 1-3 topics, exactly one tone, 1-2 humour mechanisms, confidence from 0 to 1, is_nsfw boolean.`;

const extractJson = (text: string): Record<string, unknown> => {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("Model returned invalid JSON.");
  }
};

const validateResult = (raw: Record<string, unknown>): Result => {
  const topics = Array.isArray(raw.topics) ? raw.topics.filter((value): value is string => typeof value === "string") : [];
  const mechanisms = Array.isArray(raw.humour_mechanisms) ? raw.humour_mechanisms.filter((value): value is string => typeof value === "string") : [];
  const tone = typeof raw.tone === "string" ? raw.tone : "";
  const decision = raw.decision === "exclude" ? "excluded" : raw.decision === "later" ? "review_later" : typeof raw.decision === "string" ? raw.decision : "";
  const confidence = typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : NaN;
  const is_nsfw = Boolean(raw.is_nsfw === true || raw.is_nsfw === 1 || raw.nsfw === true || raw.nsfw === 1 || raw.is_toxic === true || raw.toxicity === true);
  if (topics.length < 1 || topics.length > 3 || topics.some((value) => !TOPICS.includes(value)) ||
      !TONES.includes(tone) || mechanisms.length < 1 || mechanisms.length > 2 || mechanisms.some((value) => !MECHANISMS.includes(value)) ||
      !DECISIONS.includes(decision) || !Number.isFinite(confidence)) {
    throw new Error("Model response did not match the required taxonomy.");
  }
  if (typeof raw.reasoning !== "string" || !raw.reasoning.trim()) {
    throw new Error("Model response is missing reasoning.");
  }
  return { topics, tone, humour_mechanisms: mechanisms, decision, confidence, reasoning: raw.reasoning.slice(0, 500), is_nsfw };
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await requireAiJudgeAuth(request, env);
  const body = (await request.json().catch(() => ({}))) as Payload;
  const runId = (body.run_id || "").trim();
  const memeId = (body.meme_id || "").trim();
  const imageUrl = (body.image_url || "").trim();
  const started = Date.now();
  const config = runId ? await env.DB.prepare("SELECT provider, model, api_key, max_retries, temperature FROM ai_judge_config WHERE user_id = ?").bind(user.id).first<Config>() : null;
  const fail = async (message: string) => {
    if (runId && memeId && config) {
      await env.DB.prepare("INSERT INTO ai_judge_processed (meme_id, run_id, user_id, error, model, provider, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(memeId, runId, user.id, message.slice(0, 500), config.model, config.provider, Date.now() - started).run();
      await env.DB.prepare("UPDATE ai_judge_runs SET processed = processed + 1, failed = failed + 1 WHERE id = ? AND user_id = ?").bind(runId, user.id).run();
    }
    return json({ success: false, meme_id: memeId, error: message });
  };
  if (!runId || !memeId || !imageUrl) return fail("run_id, meme_id, and image_url are required.");
  const run = await env.DB.prepare("SELECT id, status FROM ai_judge_runs WHERE id = ? AND user_id = ?").bind(runId, user.id).first<{ id: string; status: string }>();
  if (!run || run.status !== "running") return fail("Run is not active.");
  if (!config?.api_key) return fail("AI provider configuration is missing.");

  const secretSeed = env.ADMIN_API_TOKEN || "meme-capsule-secret-token";
  const plainApiKey = await decryptApiKey(config.api_key, secretSeed);
  if (!plainApiKey) return fail("AI provider configuration key is invalid.");

  // Auto-encrypt legacy plaintext key on use if present
  if (!config.api_key.startsWith("enc:v1:")) {
    const encrypted = await encryptApiKey(config.api_key, secretSeed);
    await env.DB.prepare(
      "UPDATE ai_judge_config SET api_key = ? WHERE user_id = ?"
    ).bind(encrypted, user.id).run().catch(() => undefined);
  }

  try {
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!imageResponse.ok) throw new Error(`Image request failed with ${imageResponse.status}.`);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const base64 = btoa(binary);
    let result: Result | null = null;
    let rawText = "";
    let tokens = 0;
    let lastError = "AI request failed.";
    const retries = Math.min(5, Math.max(1, config.max_retries || 3));
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const endpoint = config.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://integrate.api.nvidia.com/v1/chat/completions";
        const content = [{ type: "text", text: buildPrompt() }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, ...(config.provider === "openai" ? { detail: "low" } : {}) } }];
        console.log(`[ai-judge] AI call starting: provider=${config.provider}, model=${config.model}, attempt=${attempt}/${retries}, meme_id=${memeId}`);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${plainApiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ model: config.model, temperature: config.temperature, max_tokens: 400, stream: false, messages: [{ role: "user", content }], ...(config.provider === "openai" ? { response_format: { type: "json_object" } } : {}) }),
          signal: AbortSignal.timeout(25000)
        });
        if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
        const payload = (await response.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
        rawText = payload.choices?.[0]?.message?.content || "";
        tokens = payload.usage?.total_tokens || 0;
        console.log(`[ai-judge] Raw AI response: ${rawText}`);
        try {
          result = validateResult(extractJson(rawText));
          console.log(`[ai-judge] AI response parsing succeeded: meme_id=${memeId}`);
        } catch (parseError: unknown) {
          const parseMessage = parseError instanceof Error ? parseError.message : "Unknown response parsing error.";
          console.error(`[ai-judge] AI response parsing failed: meme_id=${memeId}, error=${parseMessage}`);
          throw parseError;
        }
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : "AI request failed.";
        console.error(`[ai-judge] AI attempt failed: meme_id=${memeId}, attempt=${attempt}/${retries}, error=${lastError}`);
        if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
    if (!result) return fail(lastError);
    const isNsfwPositive = Boolean(result.is_nsfw || body.is_nsfw === true || body.is_nsfw === 1);
    const dbStatements = [
      env.DB.prepare("INSERT INTO ai_judge_processed (meme_id, run_id, user_id, decision, topics, tone, mechanisms, confidence, reasoning, raw_response, model, provider, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(memeId, runId, user.id, result.decision, JSON.stringify(result.topics), result.tone, JSON.stringify(result.humour_mechanisms), result.confidence, result.reasoning, rawText, config.model, config.provider, tokens, Date.now() - started),
      env.DB.prepare("UPDATE ai_judge_runs SET processed = processed + 1, succeeded = succeeded + 1 WHERE id = ? AND user_id = ?").bind(runId, user.id)
    ];
    if (isNsfwPositive) {
      dbStatements.push(
        env.DB.prepare("UPDATE memes SET is_nsfw = 1, nsfw_flagged_by = 'ai-judge' WHERE id = ?").bind(memeId)
      );
    }
    await env.DB.batch(dbStatements);
    return json({
      success: true,
      meme_id: memeId,
      decision: result.decision,
      topics: result.topics,
      tone: result.tone,
      humour_mechanisms: result.humour_mechanisms,
      confidence: result.confidence,
      reasoning: result.reasoning,
      is_nsfw: isNsfwPositive,
      tokens_used: tokens,
      duration_ms: Date.now() - started
    });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "Classification failed.");
  }
};
