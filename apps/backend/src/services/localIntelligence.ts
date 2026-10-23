import type { Category, DuplicateMatch, MlCandidate, Severity } from "../types";

/**
 * Built-in, dependency-free classification, severity grading and duplicate matching.
 * The backend always works with this; the Python ML service is an optional extra.
 */

type ScoredCategory = Exclude<Category, "other">;

/** Tie-break order when two categories score the same. */
export const CATEGORY_ORDER: readonly ScoredCategory[] = [
  "pothole",
  "garbage",
  "water_supply",
  "streetlight",
  "drainage",
  "public_safety",
  "parks",
  "traffic",
];

// Term weights: 2 = strong signal for the category, 1 = weak or ambiguous signal.
const RAW_TERMS: Readonly<Record<ScoredCategory, Readonly<Record<string, number>>>> = {
  pothole: { pothole: 2, crater: 2, asphalt: 2, road: 1, roadway: 1, crack: 1, pavement: 1 },
  garbage: {
    garbage: 2, trash: 2, waste: 2, dump: 2, litter: 2, rubbish: 2, dustbin: 2,
    sanitation: 1, smell: 1, stench: 1,
  },
  water_supply: { pipe: 2, pipeline: 2, leak: 2, tap: 2, borewell: 2, tanker: 1, water: 1, supply: 1 },
  streetlight: { streetlight: 2, lamp: 2, lamppost: 2, bulb: 2, light: 2, dark: 1 },
  drainage: {
    drain: 2, drainage: 2, sewer: 2, sewage: 2, flood: 2, waterlogging: 2, waterlogged: 2,
    manhole: 2, gutter: 2,
  },
  public_safety: {
    crime: 2, theft: 2, robbery: 2, harassment: 2, unsafe: 2, dangerous: 2, danger: 1, hazard: 2,
    accident: 2, stray: 2, dog: 1, violence: 2, drunk: 2, fire: 2, collapse: 2, wire: 1,
    electrocution: 2,
  },
  parks: { park: 2, garden: 2, tree: 2, playground: 2, lawn: 2, greenery: 2, bench: 1, branch: 1 },
  traffic: {
    traffic: 2, signal: 2, jam: 2, congestion: 2, parking: 2, crossing: 1, zebra: 1, speed: 1,
    breaker: 1, divider: 1, signage: 1,
  },
};

// Multi-word cues that single words cannot express (e.g. "traffic light" is not a streetlight).
const PHRASES: readonly { category: ScoredCategory; pattern: RegExp; weight: number }[] = [
  { category: "traffic", pattern: /\btraffic (?:light|signal)s?\b/, weight: 4 },
  { category: "streetlight", pattern: /\bstreet ?lights?\b/, weight: 2 },
  { category: "water_supply", pattern: /\bno water\b|\bwater (?:shortage|supply)\b/, weight: 2 },
  { category: "public_safety", pattern: /\bstray (?:dogs?|cattle|cows?|animals?)\b|\bgas leak\b/, weight: 3 },
  { category: "drainage", pattern: /\bopen manhole\b|\bdrain(?:age)? (?:blocked|overflow\w*)\b/, weight: 2 },
];

// "parking" must not collapse into "park".
const NO_STEM = new Set(["parking"]);

export function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Tiny suffix stripper so potholes/pothole and leaking/leak compare equal. */
export function stem(token: string): string {
  if (NO_STEM.has(token)) return token;
  for (const suffix of ["ing", "ed", "s"]) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      if (suffix === "s" && token.endsWith("ss")) return token;
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

const TERMS: Readonly<Record<ScoredCategory, ReadonlyMap<string, number>>> = {
  pothole: buildTerms("pothole"),
  garbage: buildTerms("garbage"),
  water_supply: buildTerms("water_supply"),
  streetlight: buildTerms("streetlight"),
  drainage: buildTerms("drainage"),
  public_safety: buildTerms("public_safety"),
  parks: buildTerms("parks"),
  traffic: buildTerms("traffic"),
};

function buildTerms(category: ScoredCategory): ReadonlyMap<string, number> {
  const entries = Object.entries(RAW_TERMS[category]).map(([word, weight]): [string, number] => [
    stem(word),
    weight,
  ]);
  return new Map(entries);
}

/**
 * Reports store "title\ndetails\nLocation: ..." in one description. Address words
 * ("central park", "street 99") and old "Category:/Urgency:" hints must not steer
 * classification, so they are removed first.
 */
export function classifiableText(description: string): string {
  const cleaned = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !/^(?:location|category|urgency):/i.test(line))
    .join("\n");
  return cleaned.length > 0 ? cleaned : description;
}

export interface Classification {
  category: Category;
  score: number;
}

export function classifyText(text: string): Classification {
  const counts = new Map<string, number>();
  for (const token of tokens(text)) {
    const word = stem(token);
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const lowered = text.toLowerCase();

  let best: ScoredCategory | undefined;
  let bestScore = 0;
  let total = 0;
  for (const category of CATEGORY_ORDER) {
    let score = 0;
    for (const [term, weight] of TERMS[category]) score += weight * (counts.get(term) ?? 0);
    for (const phrase of PHRASES) {
      if (phrase.category === category && phrase.pattern.test(lowered)) score += phrase.weight;
    }
    total += score;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  if (best === undefined || bestScore === 0) return { category: "other", score: 0 };
  // Confidence = how dominant the winner is x how much evidence there is.
  const confidence = (bestScore / total) * Math.min(1, bestScore / 4);
  return { category: best, score: Math.round(confidence * 1000) / 1000 };
}

export interface SeverityGrade {
  severity: Severity;
  signals: string[];
}

// Checked from most to least severe; the first tier that matches wins.
const SEVERITY_RULES: readonly { severity: Severity; pattern: RegExp }[] = [
  {
    severity: "critical",
    pattern:
      /\b(?:fire|explosion|electrocut\w*|sparking|sparks|live wire|exposed wire|collaps\w*|sinkhole|gas leak|open manhole|accident|injur\w*|burst)\b/g,
  },
  {
    severity: "high",
    pattern:
      /\b(?:flood\w*|waterlogg\w*|no water|no electricity|power cut|overflow\w*|blocked road|road block\w*|fallen tree|hazard\w*|dangerous|unsafe)\b/g,
  },
  {
    severity: "medium",
    pattern:
      /\b(?:broken|damaged|leak\w*|not working|pothole\w*|crater\w*|stench|smell\w*|clogged|blocked|dark)\b/g,
  },
];

export function gradeSeverity(text: string): SeverityGrade {
  const lowered = text.toLowerCase();
  for (const rule of SEVERITY_RULES) {
    const hits = lowered.match(rule.pattern);
    if (hits) return { severity: rule.severity, signals: [...new Set(hits)] };
  }
  return { severity: "low", signals: [] };
}

const STOPWORDS = new Set(
  "a an the is are was were be been and or of to in on at by for with from near has have had it its this that there here very some my our please".split(
    " ",
  ),
);

export const DUPLICATE_THRESHOLD = 0.3;

function contentCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens(text)) {
    if (STOPWORDS.has(token)) continue;
    const word = stem(token);
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/** Average of token Jaccard and bag-of-words cosine similarity, 0..1. */
export function similarity(a: string, b: string): number {
  const left = contentCounts(a);
  const right = contentCounts(b);
  if (left.size === 0 || right.size === 0) return 0;

  let dot = 0;
  let shared = 0;
  for (const [word, count] of left) {
    const other = right.get(word);
    if (other !== undefined) {
      dot += count * other;
      shared += 1;
    }
  }
  const union = left.size + right.size - shared;
  const norm = (counts: Map<string, number>): number => {
    let sum = 0;
    for (const value of counts.values()) sum += value * value;
    return Math.sqrt(sum);
  };
  const jaccard = shared / union;
  const cosine = dot / (norm(left) * norm(right));
  return Math.round(((jaccard + cosine) / 2) * 10_000) / 10_000;
}

/** Reports whose texts fall in different known categories are never duplicates. */
export function findDuplicates(
  description: string,
  candidates: readonly MlCandidate[],
  threshold: number = DUPLICATE_THRESHOLD,
  limit = 5,
): DuplicateMatch[] {
  const queryCategory = classifyText(description).category;
  const matches: DuplicateMatch[] = [];
  for (const candidate of candidates) {
    const candidateCategory = classifyText(candidate.text).category;
    if (queryCategory !== "other" && candidateCategory !== "other" && queryCategory !== candidateCategory) {
      continue;
    }
    const score = similarity(description, candidate.text);
    if (score >= threshold) matches.push({ id: candidate.id, similarity: score });
  }
  matches.sort((x, y) => y.similarity - x.similarity || x.id.localeCompare(y.id));
  return matches.slice(0, limit);
}