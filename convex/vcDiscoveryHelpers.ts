import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Start a discovery run
export const startDiscoveryRun = internalMutation({
  args: {
    userId: v.string(),
    runId: v.string(),
    runType: v.union(v.literal("scheduled"), v.literal("manual")),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vcDiscoveryLog", {
      userId: args.userId,
      runId: args.runId,
      runType: args.runType,
      source: args.source,
      startedAt: Date.now(),
      status: "running",
      vcsFound: 0,
      vcsImported: 0,
      vcsFlagged: 0,
      vcsSkipped: 0,
    });
  },
});

// Update discovery run progress
export const updateDiscoveryRun = internalMutation({
  args: {
    logId: v.id("vcDiscoveryLog"),
    vcsFound: v.optional(v.number()),
    vcsImported: v.optional(v.number()),
    vcsFlagged: v.optional(v.number()),
    vcsSkipped: v.optional(v.number()),
    importedVcIds: v.optional(v.array(v.id("vcConnections"))),
    flaggedVcIds: v.optional(v.array(v.id("vcConnections"))),
  },
  handler: async (ctx, args) => {
    const { logId, ...updates } = args;
    await ctx.db.patch(logId, updates);
  },
});

// Complete discovery run
export const completeDiscoveryRun = internalMutation({
  args: {
    logId: v.id("vcDiscoveryLog"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    vcsFound: v.number(),
    vcsImported: v.number(),
    vcsFlagged: v.number(),
    vcsSkipped: v.number(),
    importedVcIds: v.optional(v.array(v.id("vcConnections"))),
    flaggedVcIds: v.optional(v.array(v.id("vcConnections"))),
    errors: v.optional(v.array(v.string())),
    rawResults: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { logId, ...updates } = args;
    await ctx.db.patch(logId, {
      ...updates,
      completedAt: Date.now(),
    });
  },
});

// Check if VC already exists (by firm name)
export const checkVcExists = internalQuery({
  args: {
    userId: v.string(),
    firmName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return existing.find(
      (vc) => vc.firmName.toLowerCase() === args.firmName.toLowerCase()
    );
  },
});

// Import a discovered VC
export const importDiscoveredVc = internalMutation({
  args: {
    userId: v.string(),
    vcName: v.string(),
    firmName: v.string(),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    investmentStages: v.optional(v.array(v.string())),
    sectors: v.optional(v.array(v.string())),
    checkSize: v.optional(v.string()),
    partnerEmails: v.optional(v.array(v.object({
      name: v.string(),
      email: v.string(),
      role: v.optional(v.string()),
      linkedInUrl: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      emailSource: v.optional(v.string()),
    }))),
    portfolioCompanies: v.optional(v.array(v.object({
      name: v.string(),
      sector: v.optional(v.string()),
      stage: v.optional(v.string()),
      investmentDate: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),
    discoveredFrom: v.string(),
    activityScore: v.optional(v.number()),
    validationStatus: v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("needs_review"),
      v.literal("rejected")
    ),
    validationErrors: v.optional(v.array(v.string())),
    lastActivityDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vcConnections", {
      userId: args.userId,
      vcName: args.vcName,
      firmName: args.firmName,
      email: args.email,
      linkedInUrl: args.linkedInUrl,
      website: args.website,
      investmentStages: args.investmentStages,
      sectors: args.sectors,
      checkSize: args.checkSize,
      partnerEmails: args.partnerEmails,
      portfolioCompanies: args.portfolioCompanies,
      discoveredFrom: args.discoveredFrom,
      discoveredAt: Date.now(),
      activityScore: args.activityScore,
      validationStatus: args.validationStatus,
      validationErrors: args.validationErrors,
      lastActivityDate: args.lastActivityDate,
      relationshipStrength: "weak",
      createdAt: Date.now(),
    });
  },
});

// Get user settings for API keys
export const getUserSettings = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Get all user settings (for finding API keys)
export const getAllUserSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userSettings").collect();
  },
});

// Get recent discovery logs
export const getRecentDiscoveryLogs = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("vcDiscoveryLog")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 10);

    return logs;
  },
});

// Get VCs needing review
export const getVcsNeedingReview = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vcConnections")
      .withIndex("by_validation_status", (q) =>
        q.eq("userId", args.userId).eq("validationStatus", "needs_review")
      )
      .collect();
  },
});

// Update VC validation status
export const updateVcValidation = internalMutation({
  args: {
    vcId: v.id("vcConnections"),
    validationStatus: v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("needs_review"),
      v.literal("rejected")
    ),
    validationErrors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { vcId, ...updates } = args;
    await ctx.db.patch(vcId, updates);
  },
});
