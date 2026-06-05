import type { ContextSource, Skill } from "./enterprise-ai-data.ts";
import { evaluateContextPolicy } from "./policy-engine.ts";

export type RetrievalResult = {
  sourceId: string;
  sourceName: string;
  score: number;
  snippet: string;
  permission: "allowed" | "filtered";
};

export function retrieveContext(params: {
  skill: Skill;
  sources: ContextSource[];
  query: string;
  limit?: number;
}): {
  decision: ReturnType<typeof evaluateContextPolicy>;
  results: RetrievalResult[];
} {
  const decision = evaluateContextPolicy(params.skill);
  const allowed = new Set(decision.allowedSourceIds.map((source) => source.toLowerCase()));
  const queryTerms = params.query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = params.sources
    .map((source) => {
      const sourceAllowed = allowed.has(source.id.toLowerCase()) || allowed.has(source.name.toLowerCase());
      const searchable = `${source.name} ${source.type} ${source.classification} ${source.ownerDepartment}`.toLowerCase();
      const hits = queryTerms.filter((term) => searchable.includes(term)).length;
      const score = Math.min(0.99, 0.45 + hits * 0.14 + (sourceAllowed ? 0.2 : 0));
      return {
        sourceId: source.id,
        sourceName: source.name,
        score,
        snippet: `Source ${source.name} is ${source.classification} ${source.type} content owned by ${source.ownerDepartment}.`,
        permission: sourceAllowed ? ("allowed" as const) : ("filtered" as const),
      };
    })
    .filter((result) => result.permission === "allowed")
    .sort((left, right) => right.score - left.score)
    .slice(0, params.limit ?? 5);

  return { decision, results };
}
