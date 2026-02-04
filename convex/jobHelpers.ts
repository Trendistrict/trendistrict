import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import {
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  isJobRunning,
  getRecentJobs,
} from "./lib/jobManager";
import {
  recordRequest,
  canMakeRequest,
  getRateLimitStatus,
  ApiName,
} from "./lib/rateLimiter";

// ============ JOB MANAGEMENT ============

export const startJobRun = internalMutation({
  args: {
    userId: v.string(),
    jobType: v.union(
      v.literal("discovery"),
      v.literal("enrichment"),
      v.literal("outreach")
    ),
    itemsTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await startJob(ctx, args.userId, args.jobType, args.itemsTotal);
  },
});

export const updateJobProgressMutation = internalMutation({
  args: {
    jobId: v.id("jobRuns"),
    itemsProcessed: v.number(),
    itemsFailed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await updateJobProgress(ctx, args.jobId, args.itemsProcessed, args.itemsFailed);
  },
});

export const completeJobMutation = internalMutation({
  args: {
    jobId: v.id("jobRuns"),
    results: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await completeJob(ctx, args.jobId, args.results);
  },
});

export const failJobMutation = internalMutation({
  args: {
    jobId: v.id("jobRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await failJob(ctx, args.jobId, args.error);
  },
});

export const checkJobRunning = internalQuery({
  args: {
    userId: v.string(),
    jobType: v.union(
      v.literal("discovery"),
      v.literal("enrichment"),
      v.literal("outreach")
    ),
  },
  handler: async (ctx, args) => {
    return await isJobRunning(ctx, args.userId, args.jobType);
  },
});

export const getRecentJobsQuery = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await getRecentJobs(ctx, identity.subject, args.limit ?? 10);
  },
});

// ============ RATE LIMITING ============

export const recordApiRequest = internalMutation({
  args: {
    userId: v.string(),
    apiName: v.string(),
  },
  handler: async (ctx, args) => {
    await recordRequest(ctx, args.userId, args.apiName as ApiName);
  },
});

export const checkRateLimit = internalQuery({
  args: {
    userId: v.string(),
    apiName: v.string(),
  },
  handler: async (ctx, args) => {
    return await canMakeRequest(ctx, args.userId, args.apiName as ApiName);
  },
});

export const getRateLimitStatusQuery = query({
  args: {
    apiName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await getRateLimitStatus(ctx, identity.subject, args.apiName as ApiName);
  },
});
