export type CorpusStatus = "keep" | "excluded" | "duplicate" | "review_later";

export interface HumanVote {
  user_id: string;
  corpus_status: CorpusStatus;
  duplicate_of: string | null;
  topics: string[];
  tone: string | null;
  humour_mechanisms: string[];
}

export interface AiJudgement {
  topics?: string[] | null;
  tone?: string | null;
  humour_mechanisms?: string[] | null;
}

export interface AiFallback {
  judge4?: AiJudgement | null;
  judge5?: AiJudgement | null;
}

export type ConsensusResult =
  | { kind: "pending" }
  | { kind: "arbitration"; reason: "layer0_split" | "duplicate_target_split" }
  | { kind: "hard_remove"; corpus_status: "excluded" }
  | {
      kind: "finalize";
      corpus_status: CorpusStatus;
      duplicate_of: string | null;
      topics: string[];
      tone: string | null;
      humour_mechanisms: string[];
    };

const TOPIC_ORDER = [
  "Everyday Life", "Work / Education", "Relationships", "Family", "Politics / Society",
  "Internet Culture", "Pop Culture", "Gaming", "Animals", "Food", "Technology", "Other",
];
const MECHANISM_ORDER = [
  "Relatability", "Absurdity", "Irony", "Satire", "Exaggeration", "Cringe", "Dark Humour", "Parody", "Surrealism",
];

function aiFallbackValue<T>(j4: T | null | undefined, j5: T | null | undefined, fallback: T): T {
  if (j4 == null) return fallback;
  return j5 != null && JSON.stringify(j4) === JSON.stringify(j5) ? j4 : j4;
}

function resolveSingleField(
  votes: HumanVote[],
  value: (vote: HumanVote) => string | null,
  ai4: string | null | undefined,
  ai5: string | null | undefined,
): string | null {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    const candidate = value(vote);
    if (candidate) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }
  const majority = [...counts.entries()].find(([, count]) => count >= 2)?.[0];
  return majority ?? aiFallbackValue(ai4, ai5, null);
}

function resolveMultiField(
  votes: HumanVote[],
  value: (vote: HumanVote) => string[],
  ai4: string[] | null | undefined,
  ai5: string[] | null | undefined,
  order: string[],
  max: number,
): string[] {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    for (const option of new Set(value(vote) ?? [])) {
      counts.set(option, (counts.get(option) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([left, leftCount], [right, rightCount]) =>
      rightCount - leftCount || order.indexOf(left) - order.indexOf(right),
    )
    .slice(0, max)
    .map(([option]) => option);

  if (ranked.length > 0) return ranked;
  return aiFallbackValue(ai4, ai5, [])?.slice(0, max) ?? [];
}

export function resolveHumanConsensus(votes: HumanVote[], ai: AiFallback = {}): ConsensusResult {
  const uniqueVotes = [...new Map(votes.map((vote) => [vote.user_id, vote])).values()];
  if (uniqueVotes.length < 3) return { kind: "pending" };

  const statusCounts = new Map<CorpusStatus, number>();
  for (const vote of uniqueVotes) {
    statusCounts.set(vote.corpus_status, (statusCounts.get(vote.corpus_status) ?? 0) + 1);
  }
  const statusWinner = [...statusCounts.entries()].find(([, count]) => count >= 2)?.[0];
  if (!statusWinner) return { kind: "arbitration", reason: "layer0_split" };

  let duplicateOf: string | null = null;
  if (statusWinner === "duplicate") {
    const duplicateVotes = uniqueVotes.filter((vote) => vote.corpus_status === "duplicate");
    const targetCounts = new Map<string, number>();
    for (const vote of duplicateVotes) {
      const target = vote.duplicate_of?.trim();
      if (target) targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
    }
    const targetWinner = [...targetCounts.entries()].find(([, count]) => count >= 2)?.[0];
    const unanimousDuplicate = duplicateVotes.length === 3;
    if (
      !targetWinner ||
      (unanimousDuplicate && (targetCounts.size !== 1 || targetCounts.get(targetWinner) !== 3))
    ) {
      return { kind: "arbitration", reason: "duplicate_target_split" };
    }
    duplicateOf = targetWinner;
  }

  if (statusWinner === "excluded" && uniqueVotes.every((vote) => vote.corpus_status === "excluded")) {
    return { kind: "hard_remove", corpus_status: "excluded" };
  }

  return {
    kind: "finalize",
    corpus_status: statusWinner,
    duplicate_of: duplicateOf,
    topics: resolveMultiField(uniqueVotes, (vote) => vote.topics, ai.judge4?.topics, ai.judge5?.topics, TOPIC_ORDER, 3),
    tone: resolveSingleField(uniqueVotes, (vote) => vote.tone, ai.judge4?.tone, ai.judge5?.tone),
    humour_mechanisms: resolveMultiField(
      uniqueVotes,
      (vote) => vote.humour_mechanisms,
      ai.judge4?.humour_mechanisms,
      ai.judge5?.humour_mechanisms,
      MECHANISM_ORDER,
      2,
    ),
  };
}
