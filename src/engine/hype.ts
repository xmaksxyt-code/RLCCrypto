/**
 * Description-based hype scoring for user-created coins.
 * Keyword scan → multipliers on drift, pumpBias, eventRate.
 */

interface HypeResult {
  /** 0–1 score. >0.5 = notable hype. */
  score: number;
  /** Descriptive tag for UI feedback */
  tier: "none" | "low" | "medium" | "high" | "viral";
  /** drift multiplier */
  driftMult: number;
  /** pumpBias additive boost (clamped later) */
  pumpBiasBoost: number;
  /** eventRate multiplier */
  eventRateMult: number;
  /** Initial shock pct applied at launch (0 = no shock) */
  launchShock: number;
  /** Human-readable reason */
  reason: string;
}

/** Cultural / viral keyword groups ranked by impact */
const KEYWORD_GROUPS: Array<{ weight: number; reason: string; terms: RegExp[] }> = [
  {
    weight: 1.0,
    reason: "Major unreleased title leak",
    terms: [
      /gta\s*6/i, /grand theft auto 6/i, /half.?life\s*3/i, /elder scrolls\s*(vi|6)/i,
      /metroid\s*(prime)?\s*4/i, /elden ring\s*2/i, /bloodborne\s*2/i,
    ],
  },
  {
    weight: 0.95,
    reason: "Celebrity scandal / arrest",
    terms: [
      /leaked/i, /leak/i, /scandal/i, /arrested/i, /arrest/i, /exposed/i,
      /sex tape/i, /onlyfans/i, /nudes/i,
    ],
  },
  {
    weight: 0.9,
    reason: "Government / political event",
    terms: [
      /trump/i, /elon/i, /musk/i, /election/i, /white house/i,
      /president/i, /congress/i, /ban/i, /war/i, /nuclear/i,
    ],
  },
  {
    weight: 0.85,
    reason: "Mega celebrity endorsement",
    terms: [
      /taylor swift/i, /drake/i, /kanye/i, /ye\b/i, /eminem/i, /rihanna/i,
      /beyonce/i, /messi/i, /ronaldo/i, /lebron/i, /pewdiepie/i,
      /mr\.?\s*beast/i, /logan paul/i, /jake paul/i,
    ],
  },
  {
    weight: 0.8,
    reason: "Major game / movie release",
    terms: [
      /gta/i, /call of duty/i, /cod\b/i, /fortnite/i, /minecraft/i,
      /marvel/i, /avengers/i, /star wars/i, /batman/i, /spider.?man/i,
      /pokemon/i, /zelda/i, /nintendo/i, /playstation/i,
    ],
  },
  {
    weight: 0.75,
    reason: "Financial / crypto event",
    terms: [
      /bitcoin/i, /btc/i, /eth/i, /solana/i, /sol\b/i, /binance/i,
      /coinbase/i, /ipo/i, /nasdaq/i, /wall street/i, /hedge fund/i,
      /sec/i, /lawsuit/i, /bankrupt/i, /fraud/i,
    ],
  },
  {
    weight: 0.65,
    reason: "Viral internet moment",
    terms: [
      /meme/i, /viral/i, /trending/i, /tiktok/i, /twitter/i, /reddit/i,
      /4chan/i, /dank/i, /based/i, /cringe/i, /sus/i, /rug/i, /moon/i,
      /wen lambo/i, /to the moon/i, /diamond hands/i, /apes together/i,
    ],
  },
  {
    weight: 0.5,
    reason: "General hype keywords",
    terms: [
      /exclusive/i, /secret/i, /insider/i, /early/i, /first/i,
      /biggest/i, /massive/i, /legendary/i, /historic/i, /never before/i,
      /revolutionary/i, /breakthrough/i,
    ],
  },
];

export function scoreDescription(description: string): HypeResult {
  if (!description || description.trim().length < 5) {
    return { score: 0, tier: "none", driftMult: 1, pumpBiasBoost: 0, eventRateMult: 1, launchShock: 0, reason: "" };
  }

  let totalWeight = 0;
  let bestReason = "";
  let bestWeight = 0;

  for (const group of KEYWORD_GROUPS) {
    for (const pattern of group.terms) {
      if (pattern.test(description)) {
        totalWeight += group.weight;
        if (group.weight > bestWeight) {
          bestWeight = group.weight;
          bestReason = group.reason;
        }
        break; // one match per group
      }
    }
  }

  // cap and normalize
  const raw = Math.min(totalWeight, 2.5);
  const score = raw / 2.5;

  let tier: HypeResult["tier"] = "none";
  let driftMult = 1;
  let pumpBiasBoost = 0;
  let eventRateMult = 1;
  let launchShock = 0;

  if (score >= 0.8) {
    tier = "viral";
    driftMult = 8;
    pumpBiasBoost = 0.35;
    eventRateMult = 5;
    launchShock = 60 + Math.random() * 90; // +60–150% at launch
  } else if (score >= 0.6) {
    tier = "high";
    driftMult = 4;
    pumpBiasBoost = 0.22;
    eventRateMult = 3;
    launchShock = 25 + Math.random() * 50;
  } else if (score >= 0.4) {
    tier = "medium";
    driftMult = 2.2;
    pumpBiasBoost = 0.12;
    eventRateMult = 1.8;
    launchShock = 10 + Math.random() * 20;
  } else if (score >= 0.15) {
    tier = "low";
    driftMult = 1.4;
    pumpBiasBoost = 0.05;
    eventRateMult = 1.3;
    launchShock = 0;
  }

  return { score, tier, driftMult, pumpBiasBoost, eventRateMult, launchShock, reason: bestReason };
}

export type { HypeResult };
