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

// Smart VC matching with scoring
export const getMatchingVCsForStartup = query({
  args: {
    startupId: v.id("startups"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get the startup
    const startup = await ctx.db.get(args.startupId);
    if (!startup || startup.userId !== identity.subject) {
      return [];
    }

    // Get all VC connections
    const vcs = await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Get existing introductions to avoid duplicates
    const existingIntros = await ctx.db
      .query("introductions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();

    const introducedVcIds = new Set(existingIntros.map((i) => i.vcConnectionId));

    // Score and rank VCs
    const scoredVCs = vcs
      .filter((vc) => !introducedVcIds.has(vc._id))
      .map((vc) => {
        let score = 0;
        const matchReasons: string[] = [];

        // Stage matching (highest weight)
        const startupStage = startup.fundingStage?.toLowerCase() || "pre-seed";
        const vcStages = (vc.investmentStages ?? []).map((s) => s.toLowerCase());

        if (vcStages.includes(startupStage)) {
          score += 40;
          matchReasons.push(`Invests at ${startupStage}`);
        } else if (vcStages.some((s) => s.includes("seed") && startupStage.includes("seed"))) {
          score += 25;
          matchReasons.push("Stage overlap");
        }

        // Sector matching
        const startupSectors = inferSectorsFromSIC(startup.sicCodes ?? []);
        const vcSectors = (vc.sectors ?? []).map((s) => s.toLowerCase());

        for (const sector of startupSectors) {
          if (vcSectors.some((vs) => vs.includes(sector) || sector.includes(vs))) {
            score += 20;
            matchReasons.push(`Sector: ${sector}`);
            break;
          }
        }

        // Relationship strength bonus
        if (vc.relationshipStrength === "strong") {
          score += 25;
          matchReasons.push("Strong relationship");
        } else if (vc.relationshipStrength === "moderate") {
          score += 15;
          matchReasons.push("Moderate relationship");
        } else {
          score += 5;
        }

        // Recent contact bonus
        if (vc.lastContactDate) {
          const daysSinceContact = (Date.now() - vc.lastContactDate) / (1000 * 60 * 60 * 24);
          if (daysSinceContact < 30) {
            score += 10;
            matchReasons.push("Recent contact");
          }
        }

        return {
          ...vc,
          matchScore: score,
          matchReasons,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return scoredVCs;
  },
});

// Helper to infer sectors from SIC codes
function inferSectorsFromSIC(sicCodes: string[]): string[] {
  const sectors: string[] = [];

  const sicToSector: Record<string, string> = {
    "62": "software",
    "63": "data",
    "64": "fintech",
    "65": "insurtech",
    "66": "fintech",
    "72": "ai",
    "86": "healthtech",
    "85": "edtech",
    "68": "proptech",
    "35": "cleantech",
    "38": "cleantech",
    "47": "ecommerce",
    "49": "logistics",
    "52": "logistics",
  };

  for (const sic of sicCodes) {
    const prefix = sic.substring(0, 2);
    if (sicToSector[prefix] && !sectors.includes(sicToSector[prefix])) {
      sectors.push(sicToSector[prefix]);
    }
  }

  return sectors;
}

// Batch match all qualified startups with VCs
export const getVCMatchesForQualifiedStartups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get qualified startups
    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("stage"), "qualified"))
      .collect();

    // Get all VCs
    const vcs = await ctx.db
      .query("vcConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    // Get all existing introductions
    const introductions = await ctx.db
      .query("introductions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const matches: Array<{
      startup: typeof startups[0];
      topVCs: Array<{
        vc: typeof vcs[0];
        score: number;
        reasons: string[];
      }>;
    }> = [];

    for (const startup of startups) {
      const introducedVcIds = new Set(
        introductions
          .filter((i) => i.startupId === startup._id)
          .map((i) => i.vcConnectionId)
      );

      const scoredVCs = vcs
        .filter((vc) => !introducedVcIds.has(vc._id))
        .map((vc) => {
          let score = 0;
          const reasons: string[] = [];

          // Stage matching
          const startupStage = startup.fundingStage?.toLowerCase() || "pre-seed";
          const vcStages = (vc.investmentStages ?? []).map((s) => s.toLowerCase());

          if (vcStages.includes(startupStage)) {
            score += 40;
            reasons.push(`Invests at ${startupStage}`);
          }

          // Sector matching
          const startupSectors = inferSectorsFromSIC(startup.sicCodes ?? []);
          const vcSectors = (vc.sectors ?? []).map((s) => s.toLowerCase());

          for (const sector of startupSectors) {
            if (vcSectors.some((vs) => vs.includes(sector))) {
              score += 20;
              reasons.push(`Sector: ${sector}`);
              break;
            }
          }

          // Relationship bonus
          if (vc.relationshipStrength === "strong") score += 25;
          else if (vc.relationshipStrength === "moderate") score += 15;

          return { vc, score, reasons };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (scoredVCs.length > 0) {
        matches.push({ startup, topVCs: scoredVCs });
      }
    }

    return matches;
  },
});
