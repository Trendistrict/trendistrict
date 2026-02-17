import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to save discovered startup
export const saveDiscoveredStartup = internalMutation({
  args: {
    userId: v.string(),
    company: v.object({
      companyNumber: v.string(),
      companyName: v.string(),
      incorporationDate: v.string(),
      companyStatus: v.string(),
      companyType: v.string(),
      registeredAddress: v.optional(v.string()),
      sicCodes: v.optional(v.array(v.string())),
    }),
    officers: v.array(
      v.object({
        name: v.string(),
        role: v.string(),
        appointedOn: v.optional(v.string()),
        nationality: v.optional(v.string()),
        occupation: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if company already exists
    const existing = await ctx.db
      .query("startups")
      .withIndex("by_company_number", (q) => q.eq("companyNumber", args.company.companyNumber))
      .first();

    if (existing) {
      return existing._id;
    }

    // Determine if likely stealth (no website, minimal filings, recent)
    const incorporationDate = new Date(args.company.incorporationDate);
    const daysSinceIncorporation = Math.floor(
      (Date.now() - incorporationDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isLikelyStealth = daysSinceIncorporation < 90;
    const isRecentlyAnnounced = daysSinceIncorporation >= 90 && daysSinceIncorporation < 180;

    // Create startup record
    const startupId = await ctx.db.insert("startups", {
      userId: args.userId,
      companyNumber: args.company.companyNumber,
      companyName: args.company.companyName,
      incorporationDate: args.company.incorporationDate,
      companyStatus: args.company.companyStatus,
      companyType: args.company.companyType,
      registeredAddress: args.company.registeredAddress,
      sicCodes: args.company.sicCodes,
      source: "auto_sourcing",
      discoveredAt: Date.now(),
      stage: "discovered",
      isStealthMode: isLikelyStealth,
      recentlyAnnounced: isRecentlyAnnounced,
      fundingStage: "pre-seed", // Assume pre-seed for new companies
    });

    // Create founder records from officers
    for (const officer of args.officers) {
      // Parse name into first/last
      const nameParts = officer.name.split(",").map((p) => p.trim());
      const lastName = nameParts[0] || "";
      const firstName = nameParts[1] || "";

      const isFounderRole =
        officer.role === "director" ||
        officer.role === "secretary" ||
        officer.role?.toLowerCase().includes("director");

      await ctx.db.insert("founders", {
        userId: args.userId,
        startupId,
        firstName: firstName || officer.name,
        lastName: lastName,
        role: officer.role,
        isFounder: isFounderRole,
        source: "companies_house",
        discoveredAt: Date.now(),
      });
    }

    return startupId;
  },
});

// Internal query to get founder
export const getFounder = internalQuery({
  args: { founderId: v.id("founders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.founderId);
  },
});

// Internal mutation to update founder with LinkedIn data
export const updateFounderWithLinkedIn = internalMutation({
  args: {
    founderId: v.id("founders"),
    linkedInData: v.object({
      linkedInUrl: v.string(),
      headline: v.optional(v.string()),
      location: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      education: v.array(
        v.object({
          school: v.string(),
          degree: v.optional(v.string()),
          fieldOfStudy: v.optional(v.string()),
          startYear: v.optional(v.number()),
          endYear: v.optional(v.number()),
        })
      ),
      experience: v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          isCurrent: v.optional(v.boolean()),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.founderId, {
      linkedInUrl: args.linkedInData.linkedInUrl,
      headline: args.linkedInData.headline,
      location: args.linkedInData.location,
      profileImageUrl: args.linkedInData.profileImageUrl,
      education: args.linkedInData.education,
      experience: args.linkedInData.experience,
    });
  },
});

// Get startups that need LinkedIn enrichment
export const getStartupsNeedingEnrichment = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get recently discovered startups that haven't been enriched
    const startups = await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("stage"), "discovered"))
      .order("desc")
      .take(args.limit);

    return startups;
  },
});

// Get ALL startups for re-enrichment (regardless of stage)
export const getAllStartupsForReenrichment = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit);
  },
});

// Get founders needing enrichment (no LinkedIn data yet or missing new signals)
export const getFoundersNeedingReenrichment = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
    forceAll: v.optional(v.boolean()), // Re-enrich even if they have LinkedIn data
  },
  handler: async (ctx, args) => {
    const allFounders = await ctx.db
      .query("founders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit * 3); // Overfetch to filter

    if (args.forceAll) {
      return allFounders.slice(0, args.limit);
    }

    // Filter to those missing enrichment data
    return allFounders
      .filter(f => !f.linkedInUrl || !f.founderTier || !f.githubUrl)
      .slice(0, args.limit);
  },
});

// Get founders for a startup
export const getFoundersForStartup = internalQuery({
  args: {
    startupId: v.id("startups"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();
  },
});

// Update founder with enriched LinkedIn data and scores
export const updateFounderEnriched = internalMutation({
  args: {
    founderId: v.id("founders"),
    linkedInData: v.object({
      linkedInUrl: v.string(),
      headline: v.optional(v.string()),
      location: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      isStealthMode: v.optional(v.boolean()),
      isRecentlyAnnounced: v.optional(v.boolean()),
      stealthSignals: v.optional(v.array(v.string())),
      education: v.array(
        v.object({
          school: v.string(),
          degree: v.optional(v.string()),
          fieldOfStudy: v.optional(v.string()),
          startYear: v.optional(v.number()),
          endYear: v.optional(v.number()),
          isTopTier: v.optional(v.boolean()),
        })
      ),
      experience: v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          isCurrent: v.optional(v.boolean()),
          isHighGrowth: v.optional(v.boolean()),
        })
      ),
      // Enrichment signals
      isRepeatFounder: v.optional(v.boolean()),
      isTechnicalFounder: v.optional(v.boolean()),
      previousExits: v.optional(v.number()),
      yearsOfExperience: v.optional(v.number()),
      domainExpertise: v.optional(v.array(v.string())),
      hasPhd: v.optional(v.boolean()),
      hasMba: v.optional(v.boolean()),
      enrichmentConfidence: v.optional(v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      )),
    }),
    scores: v.object({
      educationScore: v.number(),
      experienceScore: v.number(),
      overallScore: v.number(),
      founderTier: v.union(
        v.literal("exceptional"),
        v.literal("strong"),
        v.literal("promising"),
        v.literal("standard")
      ),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.founderId, {
      linkedInUrl: args.linkedInData.linkedInUrl,
      headline: args.linkedInData.headline,
      location: args.linkedInData.location,
      profileImageUrl: args.linkedInData.profileImageUrl,
      education: args.linkedInData.education,
      experience: args.linkedInData.experience,
      educationScore: args.scores.educationScore,
      experienceScore: args.scores.experienceScore,
      overallScore: args.scores.overallScore,
      // New enrichment signals
      isRepeatFounder: args.linkedInData.isRepeatFounder,
      isTechnicalFounder: args.linkedInData.isTechnicalFounder,
      previousExits: args.linkedInData.previousExits,
      yearsOfExperience: args.linkedInData.yearsOfExperience,
      domainExpertise: args.linkedInData.domainExpertise,
      hasPhd: args.linkedInData.hasPhd,
      hasMba: args.linkedInData.hasMba,
      founderTier: args.scores.founderTier,
      enrichedAt: Date.now(),
      enrichmentConfidence: args.linkedInData.enrichmentConfidence,
    });
  },
});

// Update founder with social profile data (GitHub, Twitter, etc.)
export const updateFounderSocialProfiles = internalMutation({
  args: {
    founderId: v.id("founders"),
    githubUrl: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubRepos: v.optional(v.number()),
    githubBio: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    twitterBio: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { founderId, ...updates } = args;
    // Only patch fields that are actually provided
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(founderId, patch);
    }
  },
});

// Update startup with enriched data
export const updateStartupEnriched = internalMutation({
  args: {
    startupId: v.id("startups"),
    isStealthFromLinkedIn: v.boolean(),
    isRecentlyAnnounced: v.boolean(),
    companyInfo: v.optional(
      v.object({
        description: v.optional(v.string()),
        website: v.optional(v.string()),
        productDescription: v.optional(v.string()),
        businessModel: v.optional(v.string()),
        techStack: v.optional(v.array(v.string())),
        teamSize: v.optional(v.string()),
        newsArticles: v.optional(v.array(v.object({
          title: v.string(),
          url: v.string(),
          source: v.optional(v.string()),
          date: v.optional(v.string()),
        }))),
        fundingDetails: v.optional(v.array(v.object({
          round: v.optional(v.string()),
          amount: v.optional(v.string()),
          date: v.optional(v.string()),
          investors: v.optional(v.array(v.string())),
        }))),
        crunchbaseUrl: v.optional(v.string()),
        // Legacy compatibility
        funding: v.optional(v.string()),
        news: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId);
    if (!startup) return;

    // Calculate team score based on founders
    const founders = await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();

    const founderScores = founders
      .map((f) => f.overallScore)
      .filter((s): s is number => s !== undefined);

    const teamScore =
      founderScores.length > 0
        ? Math.round(founderScores.reduce((a, b) => a + b, 0) / founderScores.length)
        : undefined;

    // Calculate traction score from enrichment signals
    let tractionScore = 0;
    const info = args.companyInfo;
    if (info) {
      if (info.website) tractionScore += 15; // Has a website
      if (info.newsArticles && info.newsArticles.length > 0) tractionScore += 20; // Press coverage
      if (info.newsArticles && info.newsArticles.length >= 3) tractionScore += 10; // Multiple press mentions
      if (info.fundingDetails && info.fundingDetails.length > 0) tractionScore += 25; // Has raised funding
      if (info.teamSize) {
        const sizeScore = info.teamSize === "1-10" ? 5 : info.teamSize === "11-50" ? 15 : 20;
        tractionScore += sizeScore; // Team growth
      }
      if (info.techStack && info.techStack.length > 0) tractionScore += 5; // Detectable tech stack
      if (info.productDescription) tractionScore += 10; // Has product live
    }
    tractionScore = Math.min(100, tractionScore);

    // Determine funding stage from funding details
    let fundingStage = startup.fundingStage;
    let estimatedFunding = startup.estimatedFunding;
    if (info?.fundingDetails && info.fundingDetails.length > 0) {
      // Use the most advanced round found
      const rounds = info.fundingDetails
        .map(f => f.round)
        .filter(Boolean) as string[];

      const roundOrder = ["pre-seed", "seed", "series-a", "series-b", "series-c", "series-d"];
      for (const round of roundOrder.reverse()) {
        if (rounds.some(r => r.includes(round))) {
          fundingStage = round;
          break;
        }
      }

      // Use the latest funding amount
      const amounts = info.fundingDetails.map(f => f.amount).filter(Boolean) as string[];
      if (amounts.length > 0) {
        estimatedFunding = amounts[amounts.length - 1];
      }
    }

    await ctx.db.patch(args.startupId, {
      // Stealth signals
      isStealthMode: startup.isStealthMode || args.isStealthFromLinkedIn,
      recentlyAnnounced: startup.recentlyAnnounced || args.isRecentlyAnnounced,
      // Company data
      description: info?.description || startup.description,
      website: info?.website || startup.website,
      productDescription: info?.productDescription,
      businessModel: info?.businessModel,
      techStack: info?.techStack,
      teamSize: info?.teamSize,
      newsArticles: info?.newsArticles,
      fundingDetails: info?.fundingDetails,
      crunchbaseUrl: info?.crunchbaseUrl,
      // Funding
      fundingStage,
      estimatedFunding,
      // Notes
      notes: info?.description
        ? `${startup.notes || ""}\n\n${info.description}`.trim()
        : startup.notes,
      // Scores
      teamScore,
      tractionScore: tractionScore > 0 ? tractionScore : undefined,
      // Metadata
      enrichedAt: Date.now(),
      // Move to researching stage
      stage: "researching" as const,
    });
  },
});

// Update startup with Crunchbase data
export const updateStartupCrunchbase = internalMutation({
  args: {
    startupId: v.id("startups"),
    crunchbaseData: v.object({
      totalFunding: v.optional(v.string()),
      lastRound: v.optional(v.string()),
      lastRoundDate: v.optional(v.string()),
      investors: v.optional(v.array(v.string())),
      employeeCount: v.optional(v.string()),
      categories: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId);
    if (!startup) return;

    const patch: Record<string, unknown> = {
      crunchbaseData: args.crunchbaseData,
    };

    // Update funding stage from Crunchbase if we have it
    if (args.crunchbaseData.lastRound) {
      patch.fundingStage = args.crunchbaseData.lastRound;
    }
    if (args.crunchbaseData.totalFunding) {
      patch.estimatedFunding = args.crunchbaseData.totalFunding;
    }
    if (args.crunchbaseData.employeeCount) {
      patch.teamSize = args.crunchbaseData.employeeCount;
    }

    await ctx.db.patch(args.startupId, patch);
  },
});

// Same as updateStartupEnriched but preserves the current stage (for re-enrichment)
export const updateStartupEnrichedPreserveStage = internalMutation({
  args: {
    startupId: v.id("startups"),
    isStealthFromLinkedIn: v.boolean(),
    isRecentlyAnnounced: v.boolean(),
    companyInfo: v.optional(
      v.object({
        description: v.optional(v.string()),
        website: v.optional(v.string()),
        productDescription: v.optional(v.string()),
        businessModel: v.optional(v.string()),
        techStack: v.optional(v.array(v.string())),
        teamSize: v.optional(v.string()),
        newsArticles: v.optional(v.array(v.object({
          title: v.string(),
          url: v.string(),
          source: v.optional(v.string()),
          date: v.optional(v.string()),
        }))),
        fundingDetails: v.optional(v.array(v.object({
          round: v.optional(v.string()),
          amount: v.optional(v.string()),
          date: v.optional(v.string()),
          investors: v.optional(v.array(v.string())),
        }))),
        crunchbaseUrl: v.optional(v.string()),
        funding: v.optional(v.string()),
        news: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId);
    if (!startup) return;

    // Calculate team score
    const founders = await ctx.db
      .query("founders")
      .filter((q) => q.eq(q.field("startupId"), args.startupId))
      .collect();

    const founderScores = founders
      .map((f) => f.overallScore)
      .filter((s): s is number => s !== undefined);

    const teamScore =
      founderScores.length > 0
        ? Math.round(founderScores.reduce((a, b) => a + b, 0) / founderScores.length)
        : undefined;

    // Traction score
    let tractionScore = 0;
    const info = args.companyInfo;
    if (info) {
      if (info.website) tractionScore += 15;
      if (info.newsArticles && info.newsArticles.length > 0) tractionScore += 20;
      if (info.newsArticles && info.newsArticles.length >= 3) tractionScore += 10;
      if (info.fundingDetails && info.fundingDetails.length > 0) tractionScore += 25;
      if (info.teamSize) {
        tractionScore += info.teamSize === "1-10" ? 5 : info.teamSize === "11-50" ? 15 : 20;
      }
      if (info.techStack && info.techStack.length > 0) tractionScore += 5;
      if (info.productDescription) tractionScore += 10;
    }
    tractionScore = Math.min(100, tractionScore);

    // Funding stage
    let fundingStage = startup.fundingStage;
    let estimatedFunding = startup.estimatedFunding;
    if (info?.fundingDetails && info.fundingDetails.length > 0) {
      const rounds = info.fundingDetails.map(f => f.round).filter(Boolean) as string[];
      const roundOrder = ["pre-seed", "seed", "series-a", "series-b", "series-c", "series-d"];
      for (const round of roundOrder.reverse()) {
        if (rounds.some(r => r.includes(round))) { fundingStage = round; break; }
      }
      const amounts = info.fundingDetails.map(f => f.amount).filter(Boolean) as string[];
      if (amounts.length > 0) estimatedFunding = amounts[amounts.length - 1];
    }

    await ctx.db.patch(args.startupId, {
      isStealthMode: startup.isStealthMode || args.isStealthFromLinkedIn,
      recentlyAnnounced: startup.recentlyAnnounced || args.isRecentlyAnnounced,
      description: info?.description || startup.description,
      website: info?.website || startup.website,
      productDescription: info?.productDescription,
      businessModel: info?.businessModel,
      techStack: info?.techStack,
      teamSize: info?.teamSize,
      newsArticles: info?.newsArticles,
      fundingDetails: info?.fundingDetails,
      crunchbaseUrl: info?.crunchbaseUrl,
      fundingStage,
      estimatedFunding,
      notes: info?.description
        ? `${startup.notes || ""}\n\n${info.description}`.trim()
        : startup.notes,
      teamScore,
      tractionScore: tractionScore > 0 ? tractionScore : undefined,
      enrichedAt: Date.now(),
      // NOTE: stage is NOT changed — preserves current pipeline state
    });
  },
});
