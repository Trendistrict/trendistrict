import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Update founder with GitHub data
export const updateFounderWithGitHub = internalMutation({
  args: {
    founderId: v.id("founders"),
    githubData: v.object({
      githubUsername: v.string(),
      githubUrl: v.string(),
      githubAvatarUrl: v.optional(v.string()),
      publicRepos: v.number(),
      followers: v.number(),
      technicalScore: v.number(),
      primaryLanguages: v.array(v.string()),
      contributionLevel: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
        v.literal("none")
      ),
    }),
  },
  handler: async (ctx, args) => {
    const founder = await ctx.db.get(args.founderId);
    if (!founder) {
      throw new Error("Founder not found");
    }

    // Calculate combined score (existing + GitHub technical)
    // If founder has existing overall score, blend it with GitHub score
    // Technical founders get a boost
    let combinedScore = founder.overallScore || 0;
    if (args.githubData.technicalScore > 0) {
      // If high technical score on GitHub, boost the overall score
      const githubBoost = Math.round(args.githubData.technicalScore * 0.2); // 20% weight
      combinedScore = Math.min(100, combinedScore + githubBoost);
    }

    await ctx.db.patch(args.founderId, {
      githubUsername: args.githubData.githubUsername,
      githubUrl: args.githubData.githubUrl,
      githubAvatarUrl: args.githubData.githubAvatarUrl,
      githubPublicRepos: args.githubData.publicRepos,
      githubFollowers: args.githubData.followers,
      technicalScore: args.githubData.technicalScore,
      primaryLanguages: args.githubData.primaryLanguages,
      githubContributionLevel: args.githubData.contributionLevel,
      // Update overall score with GitHub boost
      overallScore: combinedScore > 0 ? combinedScore : undefined,
    });

    return { success: true };
  },
});
