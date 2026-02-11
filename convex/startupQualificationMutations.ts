import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to update startup with qualification results
export const updateStartupQualification = internalMutation({
  args: {
    startupId: v.id("startups"),
    overallScore: v.number(),
    teamScore: v.number(),
    marketScore: v.number(),
    bonusScore: v.optional(v.number()), // For auditability
    stage: v.union(
      v.literal("discovered"),
      v.literal("researching"),
      v.literal("qualified"),
      v.literal("contacted"),
      v.literal("meeting"),
      v.literal("introduced"),
      v.literal("passed")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { startupId, ...updates } = args;
    await ctx.db.patch(startupId, updates);
  },
});
