import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// List all startups for the current user
export const list = query({
  args: {
    stage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    if (args.stage) {
      return await ctx.db
        .query("startups")
        .withIndex("by_user_and_stage", (q) =>
          q.eq("userId", userId).eq("stage", args.stage as "discovered" | "researching" | "qualified" | "contacted" | "meeting" | "introduced" | "passed")
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Get a single startup
export const get = query({
  args: {
    id: v.id("startups"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const startup = await ctx.db.get(args.id);
    if (!startup || startup.userId !== identity.subject) {
      return null;
    }
    return startup;
  },
});

// Search startups by company name
export const search = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("startups")
      .withSearchIndex("search_company_name", (q) =>
        q.search("companyName", args.searchTerm).eq("userId", identity.subject)
      )
      .take(20);
  },
});

// Get pipeline statistics
export const getPipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const userId = identity.subject;

    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const stats = {
      total: startups.length,
      discovered: 0,
      researching: 0,
      qualified: 0,
      contacted: 0,
      meeting: 0,
      introduced: 0,
      passed: 0,
      averageScore: 0,
      stealthCount: 0,
      recentlyAnnouncedCount: 0,
    };

    let totalScore = 0;
    let scoredCount = 0;

    for (const startup of startups) {
      stats[startup.stage]++;
      if (startup.overallScore !== undefined) {
        totalScore += startup.overallScore;
        scoredCount++;
      }
      if (startup.isStealthMode) stats.stealthCount++;
      if (startup.recentlyAnnounced) stats.recentlyAnnouncedCount++;
    }

    stats.averageScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    return stats;
  },
});

// Create a new startup
export const create = mutation({
  args: {
    companyNumber: v.string(),
    companyName: v.string(),
    incorporationDate: v.string(),
    companyStatus: v.string(),
    companyType: v.string(),
    registeredAddress: v.optional(v.string()),
    sicCodes: v.optional(v.array(v.string())),
    source: v.string(),
    notes: v.optional(v.string()),
    isStealthMode: v.optional(v.boolean()),
    recentlyAnnounced: v.optional(v.boolean()),
    announcementDate: v.optional(v.string()),
    fundingStage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("startups", {
      ...args,
      userId: identity.subject,
      discoveredAt: Date.now(),
      stage: "discovered",
    });
  },
});

// Update a startup
export const update = mutation({
  args: {
    id: v.id("startups"),
    companyName: v.optional(v.string()),
    stage: v.optional(v.union(
      v.literal("discovered"),
      v.literal("researching"),
      v.literal("qualified"),
      v.literal("contacted"),
      v.literal("meeting"),
      v.literal("introduced"),
      v.literal("passed")
    )),
    notes: v.optional(v.string()),
    isStealthMode: v.optional(v.boolean()),
    recentlyAnnounced: v.optional(v.boolean()),
    announcementDate: v.optional(v.string()),
    fundingStage: v.optional(v.string()),
    estimatedFunding: v.optional(v.string()),
    overallScore: v.optional(v.number()),
    teamScore: v.optional(v.number()),
    marketScore: v.optional(v.number()),
    tractionScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const startup = await ctx.db.get(args.id);
    if (!startup || startup.userId !== identity.subject) {
      throw new Error("Startup not found");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a startup
export const remove = mutation({
  args: {
    id: v.id("startups"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const startup = await ctx.db.get(args.id);
    if (!startup || startup.userId !== identity.subject) {
      throw new Error("Startup not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Bulk create startups (for importing from Companies House)
export const bulkCreate = mutation({
  args: {
    startups: v.array(v.object({
      companyNumber: v.string(),
      companyName: v.string(),
      incorporationDate: v.string(),
      companyStatus: v.string(),
      companyType: v.string(),
      registeredAddress: v.optional(v.string()),
      sicCodes: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const insertedIds: Array<Id<"startups">> = [];
    for (const startup of args.startups) {
      const id = await ctx.db.insert("startups", {
        ...startup,
        userId: identity.subject,
        source: "companies_house",
        discoveredAt: Date.now(),
        stage: "discovered",
      });
      insertedIds.push(id);
    }

    return insertedIds;
  },
});
