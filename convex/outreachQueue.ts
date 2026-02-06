import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./authHelpers";

// List items in the outreach queue
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("sending"),
        v.literal("sent"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    let items = await ctx.db
      .query("outreachQueue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    if (args.status) {
      items = items.filter((item) => item.status === args.status);
    }

    // Fetch founder and startup details
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const founder = await ctx.db.get(item.founderId);
        const startup = item.startupId ? await ctx.db.get(item.startupId) : null;
        return {
          ...item,
          founder,
          startup,
        };
      })
    );

    return enrichedItems;
  },
});

// Get queue stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const items = await ctx.db
      .query("outreachQueue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      queued: items.filter((i) => i.status === "queued").length,
      sending: items.filter((i) => i.status === "sending").length,
      sent: items.filter((i) => i.status === "sent").length,
      failed: items.filter((i) => i.status === "failed").length,
      total: items.length,
    };
  },
});

// Add a founder to the outreach queue
export const queueOutreach = mutation({
  args: {
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),
    type: v.union(v.literal("email"), v.literal("linkedin")),
    subject: v.optional(v.string()),
    message: v.string(),
    scheduledFor: v.optional(v.number()), // When to send (default: now)
    priority: v.optional(v.number()), // Lower = higher priority (default: 100)
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify founder exists and belongs to user
    const founder = await ctx.db.get(args.founderId);
    if (!founder || founder.userId !== userId) {
      throw new Error("Founder not found");
    }

    // Check if founder is already in queue
    const existingQueue = await ctx.db
      .query("outreachQueue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("founderId"), args.founderId),
          q.or(
            q.eq(q.field("status"), "queued"),
            q.eq(q.field("status"), "sending")
          )
        )
      )
      .first();

    if (existingQueue) {
      throw new Error("Founder already has pending outreach in queue");
    }

    // For email, verify founder has email
    if (args.type === "email" && !founder.email) {
      throw new Error("Founder does not have an email address");
    }

    const now = Date.now();

    return await ctx.db.insert("outreachQueue", {
      userId,
      founderId: args.founderId,
      startupId: args.startupId,
      type: args.type,
      subject: args.subject,
      message: args.message,
      status: "queued",
      priority: args.priority ?? 100,
      scheduledFor: args.scheduledFor ?? now,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });
  },
});

// Queue outreach with template personalization
export const queuePersonalizedOutreach = mutation({
  args: {
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),
    templateId: v.id("templates"),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get founder
    const founder = await ctx.db.get(args.founderId);
    if (!founder || founder.userId !== userId) {
      throw new Error("Founder not found");
    }

    // Get template
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    // Get startup if provided
    const startup = args.startupId ? await ctx.db.get(args.startupId) : null;

    // Personalize the template
    const personalizedSubject = personalizeText(template.subject ?? "", {
      firstName: founder.firstName,
      lastName: founder.lastName,
      companyName: startup?.companyName ?? "",
    });

    const personalizedMessage = personalizeText(template.body, {
      firstName: founder.firstName,
      lastName: founder.lastName,
      companyName: startup?.companyName ?? "",
      headline: founder.headline ?? "",
    });

    // For email, verify founder has email
    if (template.type === "email" && !founder.email) {
      throw new Error("Founder does not have an email address");
    }

    const now = Date.now();

    return await ctx.db.insert("outreachQueue", {
      userId,
      founderId: args.founderId,
      startupId: args.startupId,
      type: template.type,
      subject: personalizedSubject || undefined,
      message: personalizedMessage,
      status: "queued",
      priority: 100,
      scheduledFor: args.scheduledFor ?? now,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });
  },
});

// Helper to personalize template text
function personalizeText(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
    result = result.replace(new RegExp(`{${key}}`, "g"), value);
  }
  return result;
}

// Batch queue multiple founders
export const queueBatchOutreach = mutation({
  args: {
    founderIds: v.array(v.id("founders")),
    templateId: v.id("templates"),
    delayBetweenMs: v.optional(v.number()), // Delay between each message (default: 30 min)
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get template
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    const delayMs = args.delayBetweenMs ?? 30 * 60 * 1000; // 30 minutes default
    const now = Date.now();
    let scheduledTime = now;
    const queued: string[] = [];
    const skipped: string[] = [];

    for (const founderId of args.founderIds) {
      const founder = await ctx.db.get(founderId);
      if (!founder || founder.userId !== userId) {
        skipped.push(founderId);
        continue;
      }

      // Skip if no email for email outreach
      if (template.type === "email" && !founder.email) {
        skipped.push(founderId);
        continue;
      }

      // Check if already queued
      const existingQueue = await ctx.db
        .query("outreachQueue")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("founderId"), founderId),
            q.or(
              q.eq(q.field("status"), "queued"),
              q.eq(q.field("status"), "sending")
            )
          )
        )
        .first();

      if (existingQueue) {
        skipped.push(founderId);
        continue;
      }

      // Get founder's startup for personalization
      const startup = founder.startupId
        ? await ctx.db.get(founder.startupId)
        : null;

      // Personalize
      const personalizedSubject = personalizeText(template.subject ?? "", {
        firstName: founder.firstName,
        lastName: founder.lastName,
        companyName: startup?.companyName ?? "",
      });

      const personalizedMessage = personalizeText(template.body, {
        firstName: founder.firstName,
        lastName: founder.lastName,
        companyName: startup?.companyName ?? "",
        headline: founder.headline ?? "",
      });

      await ctx.db.insert("outreachQueue", {
        userId,
        founderId,
        startupId: founder.startupId,
        type: template.type,
        subject: personalizedSubject || undefined,
        message: personalizedMessage,
        status: "queued",
        priority: 100 + queued.length, // Later items have lower priority
        scheduledFor: scheduledTime,
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
      });

      queued.push(founderId);
      scheduledTime += delayMs;
    }

    return {
      queued: queued.length,
      skipped: skipped.length,
      firstSendAt: now,
      lastSendAt: scheduledTime - delayMs,
    };
  },
});

// Cancel a queued outreach
export const cancelOutreach = mutation({
  args: {
    queueId: v.id("outreachQueue"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(args.queueId);
    if (!item || item.userId !== userId) {
      throw new Error("Queue item not found");
    }

    if (item.status !== "queued") {
      throw new Error("Can only cancel queued items");
    }

    await ctx.db.delete(args.queueId);
    return args.queueId;
  },
});

// Retry a failed outreach
export const retryOutreach = mutation({
  args: {
    queueId: v.id("outreachQueue"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const item = await ctx.db.get(args.queueId);
    if (!item || item.userId !== userId) {
      throw new Error("Queue item not found");
    }

    if (item.status !== "failed") {
      throw new Error("Can only retry failed items");
    }

    await ctx.db.patch(args.queueId, {
      status: "queued",
      attempts: 0,
      lastError: undefined,
      scheduledFor: Date.now(),
    });

    return args.queueId;
  },
});

// Clear all failed items from queue
export const clearFailed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const failedItems = await ctx.db
      .query("outreachQueue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "failed"))
      .collect();

    for (const item of failedItems) {
      await ctx.db.delete(item._id);
    }

    return { cleared: failedItems.length };
  },
});
