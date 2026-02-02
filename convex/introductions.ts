import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all introductions for the current user
export const list = query({
  args: {
    status: v.optional(v.string()),
    startupId: v.optional(v.id("startups")),
    vcConnectionId: v.optional(v.id("vcConnections")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    let introductions;

    if (args.startupId) {
      introductions = await ctx.db
        .query("introductions")
        .withIndex("by_startup", (q) => q.eq("startupId", args.startupId!))
        .order("desc")
        .collect();
    } else if (args.vcConnectionId) {
      introductions = await ctx.db
        .query("introductions")
        .withIndex("by_vc_connection", (q) => q.eq("vcConnectionId", args.vcConnectionId!))
        .order("desc")
        .collect();
    } else {
      introductions = await ctx.db
        .query("introductions")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .order("desc")
        .collect();
    }

    // Filter by user and status
    introductions = introductions.filter((i) => i.userId === identity.subject);
    if (args.status) {
      introductions = introductions.filter((i) => i.status === args.status);
    }

    return introductions;
  },
});

// Get introductions with full details
export const listWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const introductions = await ctx.db
      .query("introductions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const withDetails = await Promise.all(
      introductions.map(async (intro) => {
        const startup = await ctx.db.get(intro.startupId);
        const vcConnection = await ctx.db.get(intro.vcConnectionId);
        const founder = intro.founderId
          ? await ctx.db.get(intro.founderId)
          : null;
        return {
          ...intro,
          startup,
          vcConnection,
          founder,
        };
      })
    );

    return withDetails;
  },
});

// Get introduction statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const introductions = await ctx.db
      .query("introductions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const stats = {
      total: introductions.length,
      considering: 0,
      preparing: 0,
      sent: 0,
      accepted: 0,
      meeting_scheduled: 0,
      passed: 0,
      invested: 0,
      successRate: 0,
    };

    for (const intro of introductions) {
      stats[intro.status]++;
    }

    const completedCount = stats.accepted + stats.meeting_scheduled + stats.invested + stats.passed;
    const successCount = stats.accepted + stats.meeting_scheduled + stats.invested;
    stats.successRate = completedCount > 0 ? Math.round((successCount / completedCount) * 100) : 0;

    return stats;
  },
});

// Create a new introduction
export const create = mutation({
  args: {
    startupId: v.id("startups"),
    vcConnectionId: v.id("vcConnections"),
    founderId: v.optional(v.id("founders")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify startup and VC connection exist and belong to user
    const startup = await ctx.db.get(args.startupId);
    if (!startup || startup.userId !== identity.subject) {
      throw new Error("Startup not found");
    }

    const vcConnection = await ctx.db.get(args.vcConnectionId);
    if (!vcConnection || vcConnection.userId !== identity.subject) {
      throw new Error("VC connection not found");
    }

    return await ctx.db.insert("introductions", {
      ...args,
      userId: identity.subject,
      status: "considering",
      createdAt: Date.now(),
    });
  },
});

// Update introduction status
export const updateStatus = mutation({
  args: {
    id: v.id("introductions"),
    status: v.union(
      v.literal("considering"),
      v.literal("preparing"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("meeting_scheduled"),
      v.literal("passed"),
      v.literal("invested")
    ),
    meetingDate: v.optional(v.number()),
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const introduction = await ctx.db.get(args.id);
    if (!introduction || introduction.userId !== identity.subject) {
      throw new Error("Introduction not found");
    }

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "sent") updates.introducedAt = Date.now();
    if (args.meetingDate) updates.meetingDate = args.meetingDate;
    if (args.outcome) updates.outcome = args.outcome;
    if (args.notes) updates.notes = args.notes;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Delete an introduction
export const remove = mutation({
  args: {
    id: v.id("introductions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const introduction = await ctx.db.get(args.id);
    if (!introduction || introduction.userId !== identity.subject) {
      throw new Error("Introduction not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
