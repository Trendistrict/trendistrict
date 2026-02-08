import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./authHelpers";

// Get user settings
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return settings;
  },
});

// Create or update user settings
export const upsert = mutation({
  args: {
    companiesHouseApiKey: v.optional(v.string()),
    emailApiKey: v.optional(v.string()),
    emailProvider: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    emailFromName: v.optional(v.string()),
    linkedInProfileUrl: v.optional(v.string()),
    exaApiKey: v.optional(v.string()),
    // VC Discovery API keys
    apolloApiKey: v.optional(v.string()), // Primary: Apollo.io for emails
    hunterApiKey: v.optional(v.string()),
    rocketReachApiKey: v.optional(v.string()),
    zeroBouncApiKey: v.optional(v.string()),
    crunchbaseApiKey: v.optional(v.string()),
    defaultOutreachTemplate: v.optional(v.id("templates")),
    autoScoreFounders: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userSettings", {
        ...args,
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get templates
export const listTemplates = query({
  args: {
    type: v.optional(v.union(v.literal("email"), v.literal("linkedin"))),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    if (args.type) {
      return await ctx.db
        .query("templates")
        .withIndex("by_user_and_type", (q) =>
          q.eq("userId", userId).eq("type", args.type!)
        )
        .collect();
    }

    return await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Create a template
export const createTemplate = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("email"), v.literal("linkedin")),
    subject: v.optional(v.string()),
    body: v.string(),
    variables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("templates", {
      ...args,
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update a template
export const updateTemplate = mutation({
  args: {
    id: v.id("templates"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const template = await ctx.db.get(args.id);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete a template
export const deleteTemplate = mutation({
  args: {
    id: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const template = await ctx.db.get(args.id);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// High-growth companies management
export const listHighGrowthCompanies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    return await ctx.db
      .query("highGrowthCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const addHighGrowthCompany = mutation({
  args: {
    companyName: v.string(),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("highGrowthCompanies", {
      ...args,
      userId,
    });
  },
});

export const removeHighGrowthCompany = mutation({
  args: {
    id: v.id("highGrowthCompanies"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const company = await ctx.db.get(args.id);
    if (!company || company.userId !== userId) {
      throw new Error("Company not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Top universities management
export const listTopUniversities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    return await ctx.db
      .query("topUniversities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const addTopUniversity = mutation({
  args: {
    universityName: v.string(),
    tier: v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3")),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("topUniversities", {
      ...args,
      userId,
    });
  },
});

export const removeTopUniversity = mutation({
  args: {
    id: v.id("topUniversities"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const university = await ctx.db.get(args.id);
    if (!university || university.userId !== userId) {
      throw new Error("University not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Seed default email templates
export const seedDefaultTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Check if templates already exist
    const existingTemplates = await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingTemplates) {
      return { message: "Templates already exist" };
    }

    const now = Date.now();

    // Create founder introduction template
    await ctx.db.insert("templates", {
      userId,
      name: "Founder Introduction",
      type: "email",
      subject: "Quick intro - {{companyName}}",
      body: `Hi {{firstName}},

I came across {{companyName}} and was impressed by what you're building. I work with early-stage VCs and help connect promising founders with investors who are a good fit.

I'd love to learn more about your journey and see if I can be helpful - whether that's introductions to relevant investors, feedback on your pitch, or just sharing what I'm seeing in the market.

Would you be open to a quick 15-minute chat this week?

Best,
Robbie`,
      variables: ["firstName", "lastName", "companyName"],
      createdAt: now,
      updatedAt: now,
    });

    // Create stealth founder template
    await ctx.db.insert("templates", {
      userId,
      name: "Stealth Founder Outreach",
      type: "email",
      subject: "Connecting with stealth founders",
      body: `Hi {{firstName}},

I noticed you're working on something new and wanted to reach out. I spend my time connecting exceptional founders with early-stage VCs, particularly at pre-seed and seed.

I know stealth means you're likely heads down building, but when you're ready to start conversations with investors, I'd be happy to make some warm introductions to funds that would be a good fit.

No pressure at all - just wanted to plant the seed. Feel free to reach out whenever the timing is right.

Best,
Robbie`,
      variables: ["firstName", "lastName"],
      createdAt: now,
      updatedAt: now,
    });

    // Create follow-up template
    await ctx.db.insert("templates", {
      userId,
      name: "Follow-up",
      type: "email",
      subject: "Re: {{companyName}} - following up",
      body: `Hi {{firstName}},

Just wanted to follow up on my previous note about {{companyName}}. I know founders are incredibly busy, so I'll keep this brief.

If you're open to a quick chat about fundraising or investor introductions, I'm happy to help. If the timing isn't right, no worries at all.

Best,
Robbie`,
      variables: ["firstName", "companyName"],
      createdAt: now,
      updatedAt: now,
    });

    // Create LinkedIn template
    await ctx.db.insert("templates", {
      userId,
      name: "LinkedIn Connection",
      type: "linkedin",
      body: `Hi {{firstName}}, I came across {{companyName}} and was impressed. I connect founders with early-stage VCs - would love to chat if you're exploring funding options.`,
      variables: ["firstName", "companyName"],
      createdAt: now,
      updatedAt: now,
    });

    return { message: "Default templates created", count: 4 };
  },
});

// Seed default high-growth companies and universities
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);

    // Check if already seeded
    const existingCompanies = await ctx.db
      .query("highGrowthCompanies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingCompanies) {
      return { message: "Already seeded" };
    }

    // Seed high-growth companies
    const highGrowthCompanies = [
      { companyName: "Stripe", category: "unicorn" },
      { companyName: "Revolut", category: "unicorn" },
      { companyName: "Wise", category: "unicorn" },
      { companyName: "Monzo", category: "unicorn" },
      { companyName: "Checkout.com", category: "unicorn" },
      { companyName: "Deliveroo", category: "unicorn" },
      { companyName: "Klarna", category: "unicorn" },
      { companyName: "N26", category: "unicorn" },
      { companyName: "Spotify", category: "decacorn" },
      { companyName: "Meta", category: "decacorn" },
      { companyName: "Google", category: "decacorn" },
      { companyName: "Amazon", category: "decacorn" },
      { companyName: "Microsoft", category: "decacorn" },
      { companyName: "Apple", category: "decacorn" },
      { companyName: "McKinsey", category: "tier1_consulting" },
      { companyName: "Bain", category: "tier1_consulting" },
      { companyName: "BCG", category: "tier1_consulting" },
      { companyName: "Goldman Sachs", category: "tier1_finance" },
      { companyName: "JP Morgan", category: "tier1_finance" },
      { companyName: "Morgan Stanley", category: "tier1_finance" },
    ];

    for (const company of highGrowthCompanies) {
      await ctx.db.insert("highGrowthCompanies", {
        ...company,
        userId,
      });
    }

    // Seed top universities
    const topUniversities = [
      { universityName: "University of Oxford", tier: "tier1" as const, country: "UK" },
      { universityName: "University of Cambridge", tier: "tier1" as const, country: "UK" },
      { universityName: "Imperial College London", tier: "tier1" as const, country: "UK" },
      { universityName: "London School of Economics", tier: "tier1" as const, country: "UK" },
      { universityName: "UCL", tier: "tier1" as const, country: "UK" },
      { universityName: "Stanford University", tier: "tier1" as const, country: "USA" },
      { universityName: "MIT", tier: "tier1" as const, country: "USA" },
      { universityName: "Harvard University", tier: "tier1" as const, country: "USA" },
      { universityName: "Yale University", tier: "tier1" as const, country: "USA" },
      { universityName: "Princeton University", tier: "tier1" as const, country: "USA" },
      { universityName: "University of Edinburgh", tier: "tier2" as const, country: "UK" },
      { universityName: "King's College London", tier: "tier2" as const, country: "UK" },
      { universityName: "University of Manchester", tier: "tier2" as const, country: "UK" },
      { universityName: "University of Bristol", tier: "tier2" as const, country: "UK" },
      { universityName: "University of Warwick", tier: "tier2" as const, country: "UK" },
    ];

    for (const university of topUniversities) {
      await ctx.db.insert("topUniversities", {
        ...university,
        userId,
      });
    }

    return { message: "Seeded successfully" };
  },
});
