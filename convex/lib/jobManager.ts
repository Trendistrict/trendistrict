import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

export type JobType = "discovery" | "enrichment" | "outreach";
export type JobStatus = "running" | "completed" | "failed";

// Start a new job run
export async function startJob(
  ctx: MutationCtx,
  userId: string,
  jobType: JobType,
  itemsTotal?: number
): Promise<Id<"jobRuns">> {
  return await ctx.db.insert("jobRuns", {
    userId,
    jobType,
    status: "running",
    startedAt: Date.now(),
    itemsProcessed: 0,
    itemsTotal,
    itemsFailed: 0,
  });
}

// Update job progress
export async function updateJobProgress(
  ctx: MutationCtx,
  jobId: Id<"jobRuns">,
  itemsProcessed: number,
  itemsFailed?: number
): Promise<void> {
  const update: Partial<Doc<"jobRuns">> = { itemsProcessed };
  if (itemsFailed !== undefined) {
    update.itemsFailed = itemsFailed;
  }
  await ctx.db.patch(jobId, update);
}

// Complete a job
export async function completeJob(
  ctx: MutationCtx,
  jobId: Id<"jobRuns">,
  results?: unknown
): Promise<void> {
  await ctx.db.patch(jobId, {
    status: "completed",
    completedAt: Date.now(),
    results,
  });
}

// Fail a job
export async function failJob(
  ctx: MutationCtx,
  jobId: Id<"jobRuns">,
  error: string
): Promise<void> {
  await ctx.db.patch(jobId, {
    status: "failed",
    completedAt: Date.now(),
    error,
  });
}

// Check if a job type is already running for a user
export async function isJobRunning(
  ctx: QueryCtx,
  userId: string,
  jobType: JobType
): Promise<boolean> {
  const runningJob = await ctx.db
    .query("jobRuns")
    .withIndex("by_user_and_type", (q) =>
      q.eq("userId", userId).eq("jobType", jobType)
    )
    .filter((q) => q.eq(q.field("status"), "running"))
    .first();

  return runningJob !== null;
}

// Get recent jobs for a user
export async function getRecentJobs(
  ctx: QueryCtx,
  userId: string,
  limit: number = 10
): Promise<Doc<"jobRuns">[]> {
  return await ctx.db
    .query("jobRuns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);
}

// Get the last completed job of a type
export async function getLastCompletedJob(
  ctx: QueryCtx,
  userId: string,
  jobType: JobType
): Promise<Doc<"jobRuns"> | null> {
  return await ctx.db
    .query("jobRuns")
    .withIndex("by_user_and_type", (q) =>
      q.eq("userId", userId).eq("jobType", jobType)
    )
    .filter((q) => q.eq(q.field("status"), "completed"))
    .order("desc")
    .first();
}

// Clean up old job records (keep last 50 per user)
export async function cleanupOldJobs(
  ctx: MutationCtx,
  userId: string
): Promise<number> {
  const jobs = await ctx.db
    .query("jobRuns")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  const toDelete = jobs.slice(50);
  for (const job of toDelete) {
    await ctx.db.delete(job._id);
  }

  return toDelete.length;
}
