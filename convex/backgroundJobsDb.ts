import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ============ HELPER QUERIES/MUTATIONS FOR BACKGROUND JOBS ============
// These are separated from backgroundJobs.ts because that file uses "use node"
// and Node.js runtime only supports actions, not queries/mutations

export const getUsersWithDiscoveryEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userSettings").collect();
  },
});

export const getUsersWithEnrichmentEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("userSettings").collect();
    return settings.filter((s) => s.exaApiKey);
  },
});

export const getExistingCompanyNumbers = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return startups.map((s) => s.companyNumber);
  },
});

export const getUserSettings = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getPendingOutreach = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("outreachQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .filter((q) => q.lte(q.field("scheduledFor"), now))
      .take(10);
  },
});

export const getFounderById = internalQuery({
  args: { founderId: v.id("founders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.founderId);
  },
});

export const updateStartupStage = internalMutation({
  args: {
    startupId: v.id("startups"),
    stage: v.union(
      v.literal("discovered"),
      v.literal("researching"),
      v.literal("qualified"),
      v.literal("contacted"),
      v.literal("meeting"),
      v.literal("introduced"),
      v.literal("passed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.startupId, { stage: args.stage });
  },
});

export const updateOutreachQueueStatus = internalMutation({
  args: {
    queueId: v.id("outreachQueue"),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: args.status,
      lastError: args.error,
      lastAttemptAt: Date.now(),
    });
  },
});

export const markOutreachSent = internalMutation({
  args: {
    queueId: v.id("outreachQueue"),
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),
    subject: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const queue = await ctx.db.get(args.queueId);
    if (!queue) return;

    // Mark queue item as sent
    await ctx.db.patch(args.queueId, {
      status: "sent",
      sentAt: Date.now(),
    });

    // Create outreach record
    await ctx.db.insert("outreach", {
      userId: queue.userId,
      founderId: args.founderId,
      startupId: args.startupId,
      type: "email",
      status: "sent",
      subject: args.subject,
      message: args.message,
      createdAt: queue.createdAt,
      sentAt: Date.now(),
    });
  },
});

export const retryOutreach = internalMutation({
  args: {
    queueId: v.id("outreachQueue"),
    error: v.string(),
    nextAttemptAt: v.number(),
  },
  handler: async (ctx, args) => {
    const queue = await ctx.db.get(args.queueId);
    if (!queue) return;

    await ctx.db.patch(args.queueId, {
      status: "queued",
      attempts: queue.attempts + 1,
      lastAttemptAt: Date.now(),
      lastError: args.error,
      scheduledFor: args.nextAttemptAt,
    });
  },
});

export const getAllOldJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("jobRuns")
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "running"),
          q.lt(q.field("completedAt"), oneWeekAgo)
        )
      )
      .take(100);
  },
});

export const deleteJob = internalMutation({
  args: { jobId: v.id("jobRuns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.jobId);
  },
});

// Helper queries for auto-matching
export const getQualifiedStartups = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("stage"), "qualified"))
      .collect();
  },
});

export const getUserVCs = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getUserIntroductions = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("introductions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
