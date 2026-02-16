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

// ============ AUTO-QUALIFICATION HELPERS ============

// Get startups in "researching" stage that need qualification evaluation
export const getResearchingStartups = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "researching")
      )
      .collect();
  },
});

// Get founders for a specific startup (internal version for background jobs)
export const getFoundersForStartup = internalQuery({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();
  },
});

// Promote startup to qualified and set overall score
export const qualifyStartup = internalMutation({
  args: {
    startupId: v.id("startups"),
    overallScore: v.number(),
    teamScore: v.number(),
    marketScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.startupId, {
      stage: "qualified",
      overallScore: args.overallScore,
      teamScore: args.teamScore,
      marketScore: args.marketScore,
    });
  },
});

// ============ AUTO-MATCHING HELPERS ============

// Check if an introduction already exists for a startup-VC pair
export const checkExistingIntroduction = internalQuery({
  args: {
    startupId: v.id("startups"),
    vcConnectionId: v.id("vcConnections"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("introductions")
      .withIndex("by_startup", (q) => q.eq("startupId", args.startupId))
      .filter((q) => q.eq(q.field("vcConnectionId"), args.vcConnectionId))
      .first();
  },
});

// Create an introduction record from auto-matching
export const createAutoIntroduction = internalMutation({
  args: {
    userId: v.string(),
    startupId: v.id("startups"),
    vcConnectionId: v.id("vcConnections"),
    founderId: v.optional(v.id("founders")),
    matchScore: v.number(),
    matchReasons: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("introductions", {
      userId: args.userId,
      startupId: args.startupId,
      vcConnectionId: args.vcConnectionId,
      founderId: args.founderId,
      status: "considering",
      createdAt: Date.now(),
      notes: `Auto-matched (score: ${args.matchScore}). ${args.matchReasons}`,
    });
  },
});

// ============ AUTO-OUTREACH HELPERS ============

// Get qualified startups that haven't been contacted yet
export const getQualifiedStartupsNotContacted = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("startups")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", args.userId).eq("stage", "qualified")
      )
      .collect();
  },
});

// Get founders with emails for a startup
export const getFoundersWithEmails = internalQuery({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    const founders = await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();
    return founders.filter((f) => f.email);
  },
});

// Get default outreach template for a user
export const getUserDefaultTemplate = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // First check if user has a default template set
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (settings?.defaultOutreachTemplate) {
      const template = await ctx.db.get(settings.defaultOutreachTemplate);
      if (template) return template;
    }

    // Otherwise get first email template
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", args.userId).eq("type", "email")
      )
      .first();

    return templates;
  },
});

// Queue outreach from background job (internal mutation)
export const queueAutoOutreach = internalMutation({
  args: {
    userId: v.string(),
    founderId: v.id("founders"),
    startupId: v.id("startups"),
    subject: v.string(),
    message: v.string(),
    scheduledFor: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already queued or sent
    const existing = await ctx.db
      .query("outreachQueue")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("founderId"), args.founderId),
          q.or(
            q.eq(q.field("status"), "queued"),
            q.eq(q.field("status"), "sending"),
            q.eq(q.field("status"), "sent")
          )
        )
      )
      .first();

    if (existing) return null; // Already queued or sent

    // Also check outreach table for already-sent messages
    const alreadySent = await ctx.db
      .query("outreach")
      .withIndex("by_founder", (q) => q.eq("founderId", args.founderId))
      .first();

    if (alreadySent) return null; // Already contacted

    return await ctx.db.insert("outreachQueue", {
      userId: args.userId,
      founderId: args.founderId,
      startupId: args.startupId,
      type: "email",
      subject: args.subject,
      message: args.message,
      status: "queued",
      priority: 100,
      scheduledFor: args.scheduledFor,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });
  },
});

// Move startup to contacted stage
export const markStartupContacted = internalMutation({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId);
    if (startup && startup.stage === "qualified") {
      await ctx.db.patch(args.startupId, { stage: "contacted" });
    }
  },
});

// ============ FOUNDER EMAIL HELPERS ============

// Update founder with discovered email
export const updateFounderEmail = internalMutation({
  args: {
    founderId: v.id("founders"),
    email: v.string(),
    emailSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.founderId, {
      email: args.email,
    });
  },
});
