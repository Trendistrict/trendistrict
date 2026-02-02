import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all VC connections for the current user
export const list = query({
  args: {
    relationshipStrength: v.optional(v.union(
      v.literal("weak"),
      v.literal("moderate"),
      v.literal("strong")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    let connections = await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    if (args.relationshipStrength) {
      connections = connections.filter(
        (c) => c.relationshipStrength === args.relationshipStrength
      );
    }

    return connections;
  },
});

// Get a single VC connection
export const get = query({
  args: {
    id: v.id("vcConnections"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const connection = await ctx.db.get(args.id);
    if (!connection || connection.userId !== identity.subject) {
      return null;
    }
    return connection;
  },
});

// Search VCs by name
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
      .query("vcConnections")
      .withSearchIndex("search_vc_name", (q) =>
        q.search("vcName", args.searchTerm).eq("userId", identity.subject)
      )
      .take(20);
  },
});

// Get VCs by sector and stage match
export const findMatchingVCs = query({
  args: {
    sectors: v.optional(v.array(v.string())),
    investmentStage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const connections = await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return connections.filter((vc) => {
      // Check sector match
      if (args.sectors && args.sectors.length > 0) {
        const vcSectors = vc.sectors ?? [];
        const hasMatchingSector = args.sectors.some((s) =>
          vcSectors.some((vs) => vs.toLowerCase().includes(s.toLowerCase()))
        );
        if (!hasMatchingSector) return false;
      }

      // Check stage match
      if (args.investmentStage) {
        const vcStages = vc.investmentStages ?? [];
        const hasMatchingStage = vcStages.some((stage) =>
          stage.toLowerCase().includes(args.investmentStage!.toLowerCase())
        );
        if (!hasMatchingStage) return false;
      }

      return true;
    });
  },
});

// Create a new VC connection
export const create = mutation({
  args: {
    vcName: v.string(),
    firmName: v.string(),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    investmentStages: v.optional(v.array(v.string())),
    sectors: v.optional(v.array(v.string())),
    checkSize: v.optional(v.string()),
    relationshipStrength: v.union(
      v.literal("weak"),
      v.literal("moderate"),
      v.literal("strong")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("vcConnections", {
      ...args,
      userId: identity.subject,
      createdAt: Date.now(),
    });
  },
});

// Update a VC connection
export const update = mutation({
  args: {
    id: v.id("vcConnections"),
    vcName: v.optional(v.string()),
    firmName: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    investmentStages: v.optional(v.array(v.string())),
    sectors: v.optional(v.array(v.string())),
    checkSize: v.optional(v.string()),
    relationshipStrength: v.optional(v.union(
      v.literal("weak"),
      v.literal("moderate"),
      v.literal("strong")
    )),
    lastContactDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.db.get(args.id);
    if (!connection || connection.userId !== identity.subject) {
      throw new Error("VC connection not found");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a VC connection
export const remove = mutation({
  args: {
    id: v.id("vcConnections"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.db.get(args.id);
    if (!connection || connection.userId !== identity.subject) {
      throw new Error("VC connection not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
