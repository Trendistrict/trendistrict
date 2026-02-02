import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Education entry validator
const educationValidator = v.object({
  school: v.string(),
  degree: v.optional(v.string()),
  fieldOfStudy: v.optional(v.string()),
  startYear: v.optional(v.number()),
  endYear: v.optional(v.number()),
  isTopTier: v.optional(v.boolean()),
});

// Experience entry validator
const experienceValidator = v.object({
  company: v.string(),
  title: v.string(),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  isCurrent: v.optional(v.boolean()),
  isHighGrowth: v.optional(v.boolean()),
  description: v.optional(v.string()),
});

// List all founders for the current user
export const list = query({
  args: {
    startupId: v.optional(v.id("startups")),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const userId = identity.subject;

    let founders;
    if (args.startupId) {
      founders = await ctx.db
        .query("founders")
        .withIndex("by_user_and_startup", (q) =>
          q.eq("userId", userId).eq("startupId", args.startupId)
        )
        .collect();
    } else {
      founders = await ctx.db
        .query("founders")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Filter by minimum score if provided
    if (args.minScore !== undefined) {
      founders = founders.filter((f) => (f.overallScore ?? 0) >= args.minScore!);
    }

    return founders;
  },
});

// Get a single founder
export const get = query({
  args: {
    id: v.id("founders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const founder = await ctx.db.get(args.id);
    if (!founder || founder.userId !== identity.subject) {
      return null;
    }
    return founder;
  },
});

// Get founders with their startup info
export const listWithStartups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const founders = await ctx.db
      .query("founders")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const foundersWithStartups = await Promise.all(
      founders.map(async (founder) => {
        const startup = founder.startupId
          ? await ctx.db.get(founder.startupId)
          : null;
        return {
          ...founder,
          startup,
        };
      })
    );

    return foundersWithStartups;
  },
});

// Get top founders by score
export const getTopFounders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const founders = await ctx.db
      .query("founders")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Sort by overall score descending
    const sorted = founders
      .filter((f) => f.overallScore !== undefined)
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

    return sorted.slice(0, args.limit ?? 10);
  },
});

// Create a new founder
export const create = mutation({
  args: {
    startupId: v.optional(v.id("startups")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    linkedInId: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    role: v.optional(v.string()),
    isFounder: v.boolean(),
    education: v.optional(v.array(educationValidator)),
    experience: v.optional(v.array(experienceValidator)),
    source: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("founders", {
      ...args,
      userId: identity.subject,
      discoveredAt: Date.now(),
    });
  },
});

// Update a founder
export const update = mutation({
  args: {
    id: v.id("founders"),
    startupId: v.optional(v.id("startups")),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    linkedInId: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),
    role: v.optional(v.string()),
    isFounder: v.optional(v.boolean()),
    education: v.optional(v.array(educationValidator)),
    experience: v.optional(v.array(experienceValidator)),
    educationScore: v.optional(v.number()),
    experienceScore: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const founder = await ctx.db.get(args.id);
    if (!founder || founder.userId !== identity.subject) {
      throw new Error("Founder not found");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a founder
export const remove = mutation({
  args: {
    id: v.id("founders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const founder = await ctx.db.get(args.id);
    if (!founder || founder.userId !== identity.subject) {
      throw new Error("Founder not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Calculate and update founder scores
export const calculateScore = mutation({
  args: {
    id: v.id("founders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const founder = await ctx.db.get(args.id);
    if (!founder || founder.userId !== identity.subject) {
      throw new Error("Founder not found");
    }

    // Calculate education score
    let educationScore = 0;
    if (founder.education && founder.education.length > 0) {
      const topTierCount = founder.education.filter((e) => e.isTopTier).length;
      const hasGraduateDegree = founder.education.some(
        (e) => e.degree?.toLowerCase().includes("master") ||
               e.degree?.toLowerCase().includes("mba") ||
               e.degree?.toLowerCase().includes("phd") ||
               e.degree?.toLowerCase().includes("doctorate")
      );

      educationScore = Math.min(100, topTierCount * 30 + (hasGraduateDegree ? 20 : 0) + 20);
    }

    // Calculate experience score
    let experienceScore = 0;
    if (founder.experience && founder.experience.length > 0) {
      const highGrowthCount = founder.experience.filter((e) => e.isHighGrowth).length;
      const seniorRoles = founder.experience.filter(
        (e) => e.title.toLowerCase().includes("head") ||
               e.title.toLowerCase().includes("director") ||
               e.title.toLowerCase().includes("vp") ||
               e.title.toLowerCase().includes("cto") ||
               e.title.toLowerCase().includes("ceo") ||
               e.title.toLowerCase().includes("founder")
      ).length;

      experienceScore = Math.min(100, highGrowthCount * 25 + seniorRoles * 15 + 20);
    }

    // Overall score is weighted average
    const overallScore = Math.round(educationScore * 0.4 + experienceScore * 0.6);

    await ctx.db.patch(args.id, {
      educationScore,
      experienceScore,
      overallScore,
    });

    return { educationScore, experienceScore, overallScore };
  },
});
