import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./authHelpers";

// ========== INTERNAL QUERIES ==========

// Internal query to get startup with founders (used by qualification action)
export const getStartupWithFounders = internalQuery({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId);
    if (!startup) return null;

    const founders = await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();

    return { startup, founders };
  },
});

// Get startups pending qualification
export const getStartupsPendingQualification = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get startups in both "discovered" and "researching" stages
    // We can qualify startups even without LinkedIn enrichment (market-weighted scoring)
    const discoveredStartups = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "discovered")
      )
      .take(args.limit);

    const researchingStartups = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "researching")
      )
      .take(args.limit);

    // Combine and limit
    const combined = [...discoveredStartups, ...researchingStartups];
    return combined.slice(0, args.limit);
  },
});

// Get startups that need enrichment (discovered but not researched)
export const getStartupsNeedingEnrichment = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "discovered")
      )
      .order("desc")
      .take(args.limit);

    return startups;
  },
});

// ========== PUBLIC QUERIES ==========

// Quality thresholds (must match startupQualification.ts)
const QUALITY_THRESHOLDS = {
  TIER_A_MINIMUM: 80,
  TIER_B_MINIMUM: 65,
  TIER_C_MINIMUM: 50,
};

// Public query to get qualified startups for the UI
export const listQualifiedStartups = query({
  args: {
    minScore: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const minScore = args.minScore ?? 50;
    const limit = args.limit ?? 50;

    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", userId).eq("stage", "qualified")
      )
      .order("desc")
      .take(limit);

    // Filter by score and get founders
    const results = [];
    for (const startup of startups) {
      if ((startup.overallScore ?? 0) < minScore) continue;

      const founders = await ctx.db
        .query("founders")
        .filter((q) => q.eq(q.field("startupId"), startup._id))
        .collect();

      // Determine tier based on score
      const score = startup.overallScore ?? 0;
      let tier: "A" | "B" | "C" | "D" = "D";
      if (score >= QUALITY_THRESHOLDS.TIER_A_MINIMUM) tier = "A";
      else if (score >= QUALITY_THRESHOLDS.TIER_B_MINIMUM) tier = "B";
      else if (score >= QUALITY_THRESHOLDS.TIER_C_MINIMUM) tier = "C";

      results.push({
        ...startup,
        tier,
        founders: founders.map(f => ({
          _id: f._id,
          firstName: f.firstName,
          lastName: f.lastName,
          linkedInUrl: f.linkedInUrl,
          overallScore: f.overallScore,
          role: f.role,
          email: f.email,
        })),
      });
    }

    // Sort by score descending
    return results.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  },
});

// Public query to get pipeline statistics
export const getPipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Get counts for each stage
    const discovered = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) => q.eq("userId", userId).eq("stage", "discovered"))
      .collect();

    const researching = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) => q.eq("userId", userId).eq("stage", "researching"))
      .collect();

    const qualified = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) => q.eq("userId", userId).eq("stage", "qualified"))
      .collect();

    const contacted = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) => q.eq("userId", userId).eq("stage", "contacted"))
      .collect();

    const passed = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) => q.eq("userId", userId).eq("stage", "passed"))
      .collect();

    // Calculate tier breakdown for qualified startups
    let tierA = 0, tierB = 0, tierC = 0;
    for (const s of qualified) {
      const score = s.overallScore ?? 0;
      if (score >= QUALITY_THRESHOLDS.TIER_A_MINIMUM) tierA++;
      else if (score >= QUALITY_THRESHOLDS.TIER_B_MINIMUM) tierB++;
      else if (score >= QUALITY_THRESHOLDS.TIER_C_MINIMUM) tierC++;
    }

    return {
      discovered: discovered.length,
      researching: researching.length,
      qualified: qualified.length,
      contacted: contacted.length,
      passed: passed.length,
      tiers: {
        A: tierA,
        B: tierB,
        C: tierC,
      },
      totalInPipeline: discovered.length + researching.length + qualified.length + contacted.length,
    };
  },
});

// Internal query to get qualified startups ready for outreach (used by background jobs)
export const getQualifiedStartups = internalQuery({
  args: {
    userId: v.string(),
    minScore: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const minScore = args.minScore ?? QUALITY_THRESHOLDS.TIER_B_MINIMUM;
    const limit = args.limit ?? 20;

    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "qualified")
      )
      .filter((q) =>
        q.gte(q.field("overallScore"), minScore)
      )
      .order("desc")
      .take(limit);

    // Get founders for each startup
    const results = [];
    for (const startup of startups) {
      const founders = await ctx.db
        .query("founders")
        .filter((q) => q.eq(q.field("startupId"), startup._id))
        .collect();

      results.push({ startup, founders });
    }

    return results;
  },
});
