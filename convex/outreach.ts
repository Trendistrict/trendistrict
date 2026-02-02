import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all outreach for the current user
export const list = query({
  args: {
    status: v.optional(v.string()),
    type: v.optional(v.union(v.literal("email"), v.literal("linkedin"))),
    founderId: v.optional(v.id("founders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    let outreachList;

    if (args.founderId) {
      outreachList = await ctx.db
        .query("outreach")
        .withIndex("by_founder", (q) => q.eq("founderId", args.founderId!))
        .order("desc")
        .collect();
      // Filter by user
      outreachList = outreachList.filter((o) => o.userId === userId);
    } else if (args.status) {
      outreachList = await ctx.db
        .query("outreach")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", userId).eq("status", args.status as "draft" | "scheduled" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed")
        )
        .order("desc")
        .collect();
    } else {
      outreachList = await ctx.db
        .query("outreach")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Filter by type if provided
    if (args.type) {
      outreachList = outreachList.filter((o) => o.type === args.type);
    }

    return outreachList;
  },
});

// Get outreach with founder and startup info
export const listWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const outreachList = await ctx.db
      .query("outreach")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const withDetails = await Promise.all(
      outreachList.map(async (outreach) => {
        const founder = await ctx.db.get(outreach.founderId);
        const startup = outreach.startupId
          ? await ctx.db.get(outreach.startupId)
          : null;
        return {
          ...outreach,
          founder,
          startup,
        };
      })
    );

    return withDetails;
  },
});

// Get outreach statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const outreachList = await ctx.db
      .query("outreach")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const stats = {
      total: outreachList.length,
      draft: 0,
      scheduled: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      failed: 0,
      emailCount: 0,
      linkedInCount: 0,
      responseRate: 0,
      openRate: 0,
    };

    for (const outreach of outreachList) {
      stats[outreach.status]++;
      if (outreach.type === "email") stats.emailCount++;
      if (outreach.type === "linkedin") stats.linkedInCount++;
    }

    const sentCount = stats.sent + stats.delivered + stats.opened + stats.replied;
    stats.responseRate = sentCount > 0 ? Math.round((stats.replied / sentCount) * 100) : 0;
    stats.openRate = sentCount > 0 ? Math.round(((stats.opened + stats.replied) / sentCount) * 100) : 0;

    return stats;
  },
});

// Create a new outreach
export const create = mutation({
  args: {
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),
    type: v.union(v.literal("email"), v.literal("linkedin")),
    subject: v.optional(v.string()),
    message: v.string(),
    template: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify founder exists and belongs to user
    const founder = await ctx.db.get(args.founderId);
    if (!founder || founder.userId !== identity.subject) {
      throw new Error("Founder not found");
    }

    return await ctx.db.insert("outreach", {
      ...args,
      userId: identity.subject,
      status: args.scheduledFor ? "scheduled" : "draft",
      createdAt: Date.now(),
    });
  },
});

// Update outreach status
export const updateStatus = mutation({
  args: {
    id: v.id("outreach"),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("replied"),
      v.literal("bounced"),
      v.literal("failed")
    ),
    response: v.optional(v.string()),
    sentiment: v.optional(v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const outreach = await ctx.db.get(args.id);
    if (!outreach || outreach.userId !== identity.subject) {
      throw new Error("Outreach not found");
    }

    const updates: Record<string, unknown> = { status: args.status };

    // Set timestamp based on status
    if (args.status === "sent") updates.sentAt = Date.now();
    if (args.status === "opened") updates.openedAt = Date.now();
    if (args.status === "replied") {
      updates.repliedAt = Date.now();
      if (args.response) updates.response = args.response;
      if (args.sentiment) updates.sentiment = args.sentiment;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Update outreach content
export const update = mutation({
  args: {
    id: v.id("outreach"),
    subject: v.optional(v.string()),
    message: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const outreach = await ctx.db.get(args.id);
    if (!outreach || outreach.userId !== identity.subject) {
      throw new Error("Outreach not found");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete outreach
export const remove = mutation({
  args: {
    id: v.id("outreach"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const outreach = await ctx.db.get(args.id);
    if (!outreach || outreach.userId !== identity.subject) {
      throw new Error("Outreach not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
