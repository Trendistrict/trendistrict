"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { DEFAULT_USER_ID } from "./authHelpers";

// Quality thresholds for automatic qualification
const QUALITY_THRESHOLDS = {
  // Minimum scores for automatic qualification
  MINIMUM_OVERALL_SCORE: 60, // Must have at least 60/100 overall
  MINIMUM_TEAM_SCORE: 50, // Team must score at least 50/100

  // Tier definitions
  TIER_A_MINIMUM: 80, // Top tier - immediate outreach priority
  TIER_B_MINIMUM: 65, // Good prospects - qualified for outreach
  TIER_C_MINIMUM: 50, // Watchlist - needs more research

  // Bonus multipliers
  STEALTH_BONUS: 10, // Bonus for stealth mode startups
  RECENTLY_ANNOUNCED_BONUS: 5, // Bonus for recently announced
  MULTIPLE_FOUNDERS_BONUS: 5, // Bonus for having multiple quality founders
};

// SIC code scoring - indicates market attractiveness and scalability
const SIC_SCORES: Record<string, { score: number; category: string }> = {
  // AI & Deep Tech (highest scores)
  "62011": { score: 95, category: "AI/Software" },
  "72190": { score: 90, category: "R&D/DeepTech" },
  "72200": { score: 90, category: "R&D/DeepTech" },

  // SaaS & Software
  "62012": { score: 85, category: "Software" },
  "62020": { score: 75, category: "IT Services" },
  "62030": { score: 80, category: "Cloud/Hosting" },
  "62090": { score: 70, category: "IT Services" },

  // Data & Cloud
  "63110": { score: 85, category: "Data Processing" },
  "63120": { score: 80, category: "Web Platform" },

  // Fintech
  "64209": { score: 90, category: "Fintech" },
  "64303": { score: 85, category: "Fintech" },
  "64921": { score: 80, category: "Fintech" },
  "64999": { score: 75, category: "Fintech" },
  "66110": { score: 75, category: "Fintech" },

  // HealthTech
  "86210": { score: 80, category: "HealthTech" },
  "86220": { score: 80, category: "HealthTech" },

  // EdTech
  "85421": { score: 75, category: "EdTech" },
  "85590": { score: 70, category: "EdTech" },

  // E-commerce
  "47910": { score: 65, category: "E-commerce" },

  // CleanTech
  "35110": { score: 80, category: "CleanTech" },
  "35120": { score: 75, category: "CleanTech" },
};

// Calculate market score based on SIC codes
function calculateMarketScore(sicCodes: string[] | undefined): {
  score: number;
  category: string;
  reasoning: string;
} {
  if (!sicCodes || sicCodes.length === 0) {
    return { score: 50, category: "Unknown", reasoning: "No SIC codes available" };
  }

  let bestScore = 0;
  let bestCategory = "Other";

  for (const sic of sicCodes) {
    const sicInfo = SIC_SCORES[sic];
    if (sicInfo && sicInfo.score > bestScore) {
      bestScore = sicInfo.score;
      bestCategory = sicInfo.category;
    }
  }

  if (bestScore === 0) {
    return { score: 40, category: "Traditional", reasoning: "Non-tech SIC codes" };
  }

  return {
    score: bestScore,
    category: bestCategory,
    reasoning: `High-value sector: ${bestCategory}`,
  };
}

// Calculate overall startup score
export interface StartupScoreResult {
  overallScore: number;
  teamScore: number;
  marketScore: number;
  bonusScore: number;
  tier: "A" | "B" | "C" | "D";
  qualificationStatus: "qualified" | "watchlist" | "passed" | "needs_research";
  reasoning: string[];
}

function calculateStartupScore(
  founders: Array<{ overallScore?: number; isFounder: boolean }>,
  sicCodes: string[] | undefined,
  isStealthMode: boolean | undefined,
  recentlyAnnounced: boolean | undefined
): StartupScoreResult {
  const reasoning: string[] = [];

  // 1. Calculate team score (weighted average of founder scores)
  const founderScores = founders
    .filter(f => f.isFounder && f.overallScore !== undefined)
    .map(f => f.overallScore!);

  let teamScore = 0;
  let foundersEnriched = founderScores.length > 0;

  if (foundersEnriched) {
    teamScore = Math.round(
      founderScores.reduce((a, b) => a + b, 0) / founderScores.length
    );
    reasoning.push(`Team score: ${teamScore} (${founderScores.length} founders scored)`);
  } else {
    // When founders aren't enriched, use a neutral score (50)
    // so qualification proceeds based primarily on market
    teamScore = 50;
    reasoning.push("Team score: 50 (pending LinkedIn enrichment - using neutral)");
  }

  // 2. Calculate market score
  const marketResult = calculateMarketScore(sicCodes);
  const marketScore = marketResult.score;
  reasoning.push(`Market score: ${marketScore} - ${marketResult.reasoning}`);

  // 3. Calculate bonus score
  let bonusScore = 0;
  if (isStealthMode) {
    bonusScore += QUALITY_THRESHOLDS.STEALTH_BONUS;
    reasoning.push(`Stealth mode bonus: +${QUALITY_THRESHOLDS.STEALTH_BONUS}`);
  }
  if (recentlyAnnounced) {
    bonusScore += QUALITY_THRESHOLDS.RECENTLY_ANNOUNCED_BONUS;
    reasoning.push(`Recently announced bonus: +${QUALITY_THRESHOLDS.RECENTLY_ANNOUNCED_BONUS}`);
  }
  if (founderScores.length >= 2 && founderScores.every(s => s >= 60)) {
    bonusScore += QUALITY_THRESHOLDS.MULTIPLE_FOUNDERS_BONUS;
    reasoning.push(`Multiple quality founders bonus: +${QUALITY_THRESHOLDS.MULTIPLE_FOUNDERS_BONUS}`);
  }

  // 4. Calculate overall score (weighted)
  // When founders aren't enriched, rely more on market score
  let overallScore: number;
  if (foundersEnriched) {
    // Normal weighting: Team: 50%, Market: 40%, Bonus: 10%
    overallScore = Math.min(100, Math.round(
      teamScore * 0.5 + marketScore * 0.4 + bonusScore
    ));
  } else {
    // Without founder data: Team: 30%, Market: 60%, Bonus: 10%
    // This allows good market sectors to qualify even without founder enrichment
    overallScore = Math.min(100, Math.round(
      teamScore * 0.3 + marketScore * 0.6 + bonusScore
    ));
    reasoning.push("Using market-weighted scoring (founders pending enrichment)");
  }

  // 5. Determine tier and qualification status
  let tier: "A" | "B" | "C" | "D";
  let qualificationStatus: "qualified" | "watchlist" | "passed" | "needs_research";

  if (overallScore >= QUALITY_THRESHOLDS.TIER_A_MINIMUM) {
    tier = "A";
    qualificationStatus = "qualified";
    reasoning.push("Tier A: Top priority for outreach");
  } else if (overallScore >= QUALITY_THRESHOLDS.TIER_B_MINIMUM) {
    tier = "B";
    qualificationStatus = "qualified";
    reasoning.push("Tier B: Qualified for outreach");
  } else if (overallScore >= QUALITY_THRESHOLDS.TIER_C_MINIMUM) {
    tier = "C";
    // If founders aren't enriched but market is okay, mark as watchlist (allows progression)
    qualificationStatus = "watchlist";
    reasoning.push("Tier C: Watchlist - consider LinkedIn enrichment for better scoring");
  } else {
    tier = "D";
    qualificationStatus = "passed";
    reasoning.push("Tier D: Does not meet minimum criteria");
  }

  // Note: We no longer block qualification for unenriched founders
  // Instead, we use market-weighted scoring and add enrichment as a nice-to-have

  return {
    overallScore,
    teamScore,
    marketScore,
    bonusScore,
    tier,
    qualificationStatus,
    reasoning,
  };
}

// Qualify a single startup (internal - called by background jobs)
// Note: updateStartupQualification moved to startupQualificationMutations.ts
export const qualifyStartup = internalAction({
  args: {
    startupId: v.id("startups"),
  },
  handler: async (ctx, args): Promise<StartupScoreResult & { startupId: Id<"startups"> }> => {
    const data = await ctx.runQuery(internal.startupQualificationQueries.getStartupWithFounders, {
      startupId: args.startupId,
    });

    if (!data) {
      throw new Error("Startup not found");
    }

    const { startup, founders } = data;

    // Calculate scores
    const result = calculateStartupScore(
      founders,
      startup.sicCodes,
      startup.isStealthMode,
      startup.recentlyAnnounced
    );

    // Determine new stage based on qualification status
    let newStage = startup.stage;
    if (result.qualificationStatus === "qualified") {
      newStage = "qualified";
    } else if (result.qualificationStatus === "watchlist") {
      // Watchlist startups are also qualified, just lower priority (Tier C)
      // They can still receive outreach, just not as high priority
      newStage = "qualified";
    } else if (result.qualificationStatus === "passed") {
      newStage = "passed";
    } else if (result.qualificationStatus === "needs_research") {
      // Only keep in researching if explicitly needs more data
      // With our new scoring, this should rarely happen
      newStage = "researching";
    }

    // Update startup
    await ctx.runMutation(internal.startupQualificationMutations.updateStartupQualification, {
      startupId: args.startupId,
      overallScore: result.overallScore,
      teamScore: result.teamScore,
      marketScore: result.marketScore,
      stage: newStage,
      notes: `Qualification: ${result.reasoning.join("; ")}`,
    });

    return { ...result, startupId: args.startupId };
  },
});

// Batch qualify all pending startups (internal - called by background jobs)
// Note: getStartupsPendingQualification and getStartupsNeedingEnrichment moved to startupQualificationQueries.ts
export const qualifyAllPending = internalAction({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    processed: number;
    qualified: number;
    watchlist: number;
    passed: number;
    needsResearch: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = args.userId ?? identity?.subject ?? DEFAULT_USER_ID;

    const startups = await ctx.runQuery(
      internal.startupQualificationQueries.getStartupsPendingQualification,
      { userId, limit: 50 }
    );

    const results = {
      processed: 0,
      qualified: 0,
      watchlist: 0,
      passed: 0,
      needsResearch: 0,
    };

    for (const startup of startups) {
      try {
        const result = await ctx.runAction(internal.startupQualification.qualifyStartup, {
          startupId: startup._id,
        });

        results.processed++;

        switch (result.qualificationStatus) {
          case "qualified":
            results.qualified++;
            break;
          case "watchlist":
            results.watchlist++;
            break;
          case "passed":
            results.passed++;
            break;
          case "needs_research":
            results.needsResearch++;
            break;
        }
      } catch (error) {
        console.error(`Error qualifying startup ${startup._id}:`, error);
      }
    }

    return results;
  },
});

// Full pipeline: Discover → Enrich → Qualify
export const runFullPipeline = action({
  args: {
    companiesHouseApiKey: v.string(),
    exaApiKey: v.optional(v.string()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    discovery: { found: number; added: number };
    enrichment: { processed: number; enriched: number };
    qualification: { processed: number; qualified: number; watchlist: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? DEFAULT_USER_ID;

    // Step 1: Discovery
    console.log("Step 1: Running startup discovery...");
    const discoveryResult = await ctx.runAction(api.autoSourcing.runAutoSourcing, {
      apiKey: args.companiesHouseApiKey,
      daysBack: args.daysBack ?? 30,
    });

    // Step 2: Enrichment (if Exa API key provided)
    let enrichmentResult = { processed: 0, enriched: 0 };
    if (args.exaApiKey) {
      console.log("Step 2: Enriching founders with LinkedIn data...");
      const enrichResult = await ctx.runAction(api.autoSourcing.enrichDiscoveredStartups, {
        exaApiKey: args.exaApiKey,
        limit: 20,
      });
      enrichmentResult = {
        processed: enrichResult.startupsProcessed,
        enriched: enrichResult.foundersEnriched,
      };
    } else {
      console.log("Step 2: Skipping enrichment (no Exa API key)");
    }

    // Step 3: Qualification
    console.log("Step 3: Qualifying startups...");
    const qualResult = await ctx.runAction(internal.startupQualification.qualifyAllPending, { userId });

    return {
      discovery: {
        found: discoveryResult.found,
        added: discoveryResult.added,
      },
      enrichment: enrichmentResult,
      qualification: {
        processed: qualResult.processed,
        qualified: qualResult.qualified,
        watchlist: qualResult.watchlist,
      },
    };
  },
});

// ========== PUBLIC ACTIONS ==========
// Note: All queries (internal and public) are in startupQualificationQueries.ts (can't be in "use node" file)

// Public action for manual qualification trigger
export const runManualQualification = action({
  args: {},
  handler: async (ctx): Promise<{
    processed: number;
    qualified: number;
    watchlist: number;
    passed: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? DEFAULT_USER_ID;

    const result = await ctx.runAction(internal.startupQualification.qualifyAllPending, { userId });

    return {
      processed: result.processed,
      qualified: result.qualified,
      watchlist: result.watchlist,
      passed: result.passed,
    };
  },
});
