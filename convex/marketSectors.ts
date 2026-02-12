import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./authHelpers";

// ============ DEFAULT SECTOR DEFINITIONS ============

// Pre-defined sectors with SIC code mappings and keywords
const DEFAULT_SECTORS = [
  {
    sectorId: "ai-ml",
    name: "AI & Machine Learning",
    description: "Companies building artificial intelligence, machine learning, and deep learning solutions",
    parentSector: "software",
    relatedSicCodes: ["62011", "62012", "62020", "72190", "72200"],
    keywords: ["artificial intelligence", "machine learning", "deep learning", "neural network", "nlp", "computer vision", "llm", "generative ai", "gpt", "chatbot"],
    isEmerging: true,
    isHot: true,
    momentumScore: 95,
    trendDirection: "up" as const,
  },
  {
    sectorId: "fintech",
    name: "Fintech",
    description: "Financial technology companies disrupting banking, payments, and financial services",
    relatedSicCodes: ["64110", "64191", "64192", "64910", "64999", "66110", "66190", "66220"],
    keywords: ["fintech", "payments", "banking", "neobank", "lending", "credit", "defi", "crypto", "blockchain", "trading"],
    isEmerging: false,
    isHot: true,
    momentumScore: 80,
    trendDirection: "stable" as const,
  },
  {
    sectorId: "healthtech",
    name: "Healthtech",
    description: "Technology solutions for healthcare, medical devices, and life sciences",
    relatedSicCodes: ["86101", "86102", "86210", "86220", "86230", "86900", "72110"],
    keywords: ["healthtech", "medtech", "digital health", "telemedicine", "biotech", "healthcare", "medical device", "pharma", "diagnostics"],
    isEmerging: true,
    isHot: true,
    momentumScore: 85,
    trendDirection: "up" as const,
  },
  {
    sectorId: "climate-tech",
    name: "Climate Tech",
    description: "Companies addressing climate change through technology - carbon, energy, sustainability",
    relatedSicCodes: ["35110", "35120", "35130", "35140", "38110", "38120", "38210", "38220"],
    keywords: ["climate", "cleantech", "carbon", "sustainability", "renewable", "solar", "wind", "ev", "electric vehicle", "energy storage", "green"],
    isEmerging: true,
    isHot: true,
    momentumScore: 90,
    trendDirection: "up" as const,
  },
  {
    sectorId: "saas-b2b",
    name: "SaaS / B2B Software",
    description: "Business software and enterprise SaaS platforms",
    relatedSicCodes: ["62011", "62012", "62020", "62030", "62090", "63110"],
    keywords: ["saas", "b2b", "enterprise", "crm", "erp", "workflow", "automation", "analytics", "business intelligence"],
    isEmerging: false,
    isHot: false,
    momentumScore: 70,
    trendDirection: "stable" as const,
  },
  {
    sectorId: "devtools",
    name: "Developer Tools",
    description: "Tools and infrastructure for software developers",
    parentSector: "software",
    relatedSicCodes: ["62011", "62012", "62020"],
    keywords: ["developer tools", "devtools", "devops", "api", "sdk", "infrastructure", "cloud", "database", "monitoring", "testing"],
    isEmerging: true,
    isHot: true,
    momentumScore: 82,
    trendDirection: "up" as const,
  },
  {
    sectorId: "cybersecurity",
    name: "Cybersecurity",
    description: "Security software and services protecting digital assets",
    relatedSicCodes: ["62011", "62012", "62020", "62090"],
    keywords: ["security", "cybersecurity", "infosec", "encryption", "identity", "authentication", "zero trust", "soc", "siem"],
    isEmerging: false,
    isHot: true,
    momentumScore: 78,
    trendDirection: "up" as const,
  },
  {
    sectorId: "edtech",
    name: "Edtech",
    description: "Educational technology and learning platforms",
    relatedSicCodes: ["85310", "85320", "85410", "85420", "85590"],
    keywords: ["edtech", "education", "learning", "elearning", "training", "tutoring", "courses", "skills"],
    isEmerging: false,
    isHot: false,
    momentumScore: 55,
    trendDirection: "down" as const,
  },
  {
    sectorId: "proptech",
    name: "Proptech",
    description: "Real estate and property technology",
    relatedSicCodes: ["68100", "68201", "68202", "68209", "68310", "68320"],
    keywords: ["proptech", "real estate", "property", "housing", "rent", "mortgage", "construction tech"],
    isEmerging: false,
    isHot: false,
    momentumScore: 50,
    trendDirection: "down" as const,
  },
  {
    sectorId: "ecommerce",
    name: "E-commerce & Retail Tech",
    description: "Online commerce and retail technology solutions",
    relatedSicCodes: ["47110", "47190", "47910", "47990", "52100"],
    keywords: ["ecommerce", "e-commerce", "retail", "marketplace", "d2c", "dtc", "shopping", "fulfillment"],
    isEmerging: false,
    isHot: false,
    momentumScore: 60,
    trendDirection: "stable" as const,
  },
  {
    sectorId: "logistics",
    name: "Logistics & Supply Chain",
    description: "Supply chain, logistics, and warehouse technology",
    relatedSicCodes: ["49410", "49420", "52100", "52210", "52220", "52240", "52290"],
    keywords: ["logistics", "supply chain", "warehouse", "delivery", "shipping", "freight", "fleet"],
    isEmerging: false,
    isHot: false,
    momentumScore: 65,
    trendDirection: "stable" as const,
  },
  {
    sectorId: "web3-crypto",
    name: "Web3 & Crypto",
    description: "Blockchain, cryptocurrency, and decentralized applications",
    relatedSicCodes: ["64110", "64999", "62011", "62012"],
    keywords: ["web3", "crypto", "blockchain", "nft", "defi", "dao", "decentralized", "ethereum", "bitcoin", "token"],
    isEmerging: true,
    isHot: false,
    momentumScore: 45,
    trendDirection: "down" as const,
  },
  {
    sectorId: "space-tech",
    name: "Space Tech",
    description: "Space exploration, satellite, and aerospace technology",
    relatedSicCodes: ["30300", "51220", "72190"],
    keywords: ["space", "satellite", "aerospace", "rocket", "orbit", "launch"],
    isEmerging: true,
    isHot: true,
    momentumScore: 75,
    trendDirection: "up" as const,
  },
  {
    sectorId: "robotics",
    name: "Robotics & Automation",
    description: "Industrial robotics, automation, and autonomous systems",
    relatedSicCodes: ["28990", "26511", "72190"],
    keywords: ["robotics", "robot", "automation", "autonomous", "drone", "industrial automation"],
    isEmerging: true,
    isHot: true,
    momentumScore: 80,
    trendDirection: "up" as const,
  },
  {
    sectorId: "fashion-tech",
    name: "Fashion Tech",
    description: "Technology for fashion, apparel, and luxury goods",
    relatedSicCodes: ["14110", "14120", "14130", "14140", "14190", "14200", "46420", "47710", "47720"],
    keywords: ["fashion", "apparel", "clothing", "luxury", "style", "wardrobe", "fit", "sizing"],
    isEmerging: false,
    isHot: false,
    momentumScore: 55,
    trendDirection: "stable" as const,
  },
];

// ============ QUERIES ============

// Get all sectors with momentum scores
export const listSectors = query({
  args: {
    onlyHot: v.optional(v.boolean()),
    onlyEmerging: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let sectors = await ctx.db.query("marketSectors").collect();

    if (args.onlyHot) {
      sectors = sectors.filter(s => s.isHot);
    }
    if (args.onlyEmerging) {
      sectors = sectors.filter(s => s.isEmerging);
    }

    return sectors.sort((a, b) => b.momentumScore - a.momentumScore);
  },
});

// Get sector by ID
export const getSector = query({
  args: { sectorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("marketSectors")
      .withIndex("by_sector_id", q => q.eq("sectorId", args.sectorId))
      .first();
  },
});

// Get sectors for a startup (based on SIC codes)
export const getStartupSectors = query({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("startupSectors")
      .withIndex("by_startup", q => q.eq("startupId", args.startupId))
      .collect();
  },
});

// ============ INTERNAL QUERIES ============

// Get sector by SIC code
export const getSectorBySic = internalQuery({
  args: { sicCode: v.string() },
  handler: async (ctx, args) => {
    const sectors = await ctx.db.query("marketSectors").collect();

    // Find sectors that include this SIC code
    const matches = sectors.filter(s =>
      s.relatedSicCodes.some(sic =>
        args.sicCode.startsWith(sic) || sic.startsWith(args.sicCode)
      )
    );

    // Return the one with highest momentum
    return matches.sort((a, b) => b.momentumScore - a.momentumScore)[0] || null;
  },
});

// Get hot sectors (for qualification bonus)
export const getHotSectors = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("marketSectors")
      .filter(q => q.eq(q.field("isHot"), true))
      .collect();
  },
});

// ============ MUTATIONS ============

// Seed default sectors
export const seedDefaultSectors = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("marketSectors").first();
    if (existing) {
      return { message: "Sectors already seeded", count: 0 };
    }

    const now = Date.now();

    for (const sector of DEFAULT_SECTORS) {
      await ctx.db.insert("marketSectors", {
        ...sector,
        lastUpdated: now,
        dataSource: "default",
      });
    }

    return { message: "Sectors seeded successfully", count: DEFAULT_SECTORS.length };
  },
});

// Update sector momentum (manual or from API data)
export const updateSectorMomentum = mutation({
  args: {
    sectorId: v.string(),
    momentumScore: v.number(),
    dealCount30d: v.optional(v.number()),
    dealCount90d: v.optional(v.number()),
    totalFunding30d: v.optional(v.number()),
    totalFunding90d: v.optional(v.number()),
    avgDealSize: v.optional(v.number()),
    isHot: v.optional(v.boolean()),
    trendDirection: v.optional(v.union(v.literal("up"), v.literal("stable"), v.literal("down"))),
  },
  handler: async (ctx, args) => {
    await getUserId(ctx); // Ensure authenticated

    const sector = await ctx.db
      .query("marketSectors")
      .withIndex("by_sector_id", q => q.eq("sectorId", args.sectorId))
      .first();

    if (!sector) {
      throw new Error(`Sector ${args.sectorId} not found`);
    }

    const { sectorId, ...updates } = args;

    await ctx.db.patch(sector._id, {
      ...updates,
      lastUpdated: Date.now(),
    });

    return { success: true };
  },
});

// ============ INTERNAL MUTATIONS ============

// Match startup to sectors based on SIC codes
export const matchStartupToSectors = internalMutation({
  args: {
    startupId: v.id("startups"),
    sicCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all sectors
    const sectors = await ctx.db.query("marketSectors").collect();

    // Find matching sectors
    const matches: Array<{
      sectorId: string;
      confidence: number;
      momentumBonus: number;
    }> = [];

    for (const sicCode of args.sicCodes) {
      for (const sector of sectors) {
        const isMatch = sector.relatedSicCodes.some(sic =>
          sicCode.startsWith(sic) || sic.startsWith(sicCode)
        );

        if (isMatch) {
          // Calculate confidence based on match precision
          const exactMatch = sector.relatedSicCodes.includes(sicCode);
          const confidence = exactMatch ? 90 : 70;

          // Calculate momentum bonus (hot sectors get extra points in qualification)
          let momentumBonus = 0;
          if (sector.isHot && sector.momentumScore >= 80) {
            momentumBonus = 10; // +10 points for very hot sectors
          } else if (sector.isHot) {
            momentumBonus = 5; // +5 points for hot sectors
          } else if (sector.isEmerging) {
            momentumBonus = 3; // +3 points for emerging sectors
          }

          matches.push({
            sectorId: sector.sectorId,
            confidence,
            momentumBonus,
          });
        }
      }
    }

    // Remove duplicates, keeping highest confidence
    const uniqueMatches = new Map<string, typeof matches[0]>();
    for (const match of matches) {
      const existing = uniqueMatches.get(match.sectorId);
      if (!existing || match.confidence > existing.confidence) {
        uniqueMatches.set(match.sectorId, match);
      }
    }

    // Delete existing sector mappings for this startup
    const existingMappings = await ctx.db
      .query("startupSectors")
      .withIndex("by_startup", q => q.eq("startupId", args.startupId))
      .collect();

    for (const mapping of existingMappings) {
      await ctx.db.delete(mapping._id);
    }

    // Insert new mappings
    const now = Date.now();
    const uniqueMatchesArray = Array.from(uniqueMatches.values());
    for (const match of uniqueMatchesArray) {
      await ctx.db.insert("startupSectors", {
        startupId: args.startupId,
        sectorId: match.sectorId,
        confidence: match.confidence,
        matchSource: "sic_code",
        sectorMomentumBonus: match.momentumBonus,
        createdAt: now,
      });
    }

    // Return total momentum bonus for this startup
    const totalBonus = Array.from(uniqueMatches.values())
      .reduce((sum, m) => sum + m.momentumBonus, 0);

    return {
      sectorsMatched: uniqueMatches.size,
      momentumBonus: Math.min(totalBonus, 15), // Cap at 15 points
    };
  },
});

// Record a funding event (for momentum tracking)
export const recordFundingEvent = internalMutation({
  args: {
    sectorId: v.string(),
    companyName: v.string(),
    roundType: v.string(),
    amount: v.optional(v.number()),
    date: v.number(),
    leadInvestor: v.optional(v.string()),
    investors: v.optional(v.array(v.string())),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sectorFundingEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Recalculate sector momentum based on funding events
export const recalculateSectorMomentum = internalMutation({
  args: { sectorId: v.string() },
  handler: async (ctx, args) => {
    const sector = await ctx.db
      .query("marketSectors")
      .withIndex("by_sector_id", q => q.eq("sectorId", args.sectorId))
      .first();

    if (!sector) return;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Get funding events
    const events = await ctx.db
      .query("sectorFundingEvents")
      .withIndex("by_sector", q => q.eq("sectorId", args.sectorId))
      .filter(q => q.gte(q.field("date"), ninetyDaysAgo))
      .collect();

    // Calculate metrics
    const events30d = events.filter(e => e.date >= thirtyDaysAgo);
    const dealCount30d = events30d.length;
    const dealCount90d = events.length;

    const totalFunding30d = events30d
      .filter(e => e.amount)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFunding90d = events
      .filter(e => e.amount)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const avgDealSize = dealCount90d > 0 ? totalFunding90d / dealCount90d : 0;

    // Calculate momentum score (0-100)
    let momentumScore = 50; // Base score

    // Deal velocity bonus (up to +25)
    if (dealCount30d >= 10) momentumScore += 25;
    else if (dealCount30d >= 5) momentumScore += 15;
    else if (dealCount30d >= 2) momentumScore += 8;

    // Funding volume bonus (up to +25)
    if (totalFunding30d >= 100000000) momentumScore += 25; // $100M+
    else if (totalFunding30d >= 50000000) momentumScore += 18;
    else if (totalFunding30d >= 20000000) momentumScore += 10;
    else if (totalFunding30d >= 5000000) momentumScore += 5;

    // Trend direction
    const ratio = dealCount30d / Math.max(1, (dealCount90d - dealCount30d) / 2);
    let trendDirection: "up" | "stable" | "down" = "stable";
    if (ratio > 1.5) trendDirection = "up";
    else if (ratio < 0.5) trendDirection = "down";

    // Is hot if momentum >= 75 and trending up
    const isHot = momentumScore >= 75 && trendDirection !== "down";

    await ctx.db.patch(sector._id, {
      momentumScore: Math.min(100, momentumScore),
      dealCount30d,
      dealCount90d,
      totalFunding30d,
      totalFunding90d,
      avgDealSize,
      trendDirection,
      isHot,
      lastUpdated: now,
    });
  },
});
