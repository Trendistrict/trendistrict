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
