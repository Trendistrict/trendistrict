import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // UK Startups from Companies House filings
  startups: defineTable({
    userId: v.string(), // Owner of this record
    companyNumber: v.string(), // Companies House registration number
    companyName: v.string(),
    incorporationDate: v.string(),
    companyStatus: v.string(), // active, dissolved, etc.
    companyType: v.string(), // private-limited-company, etc.
    registeredAddress: v.optional(v.string()),
    sicCodes: v.optional(v.array(v.string())), // Industry classification

    // Sourcing metadata
    source: v.string(), // "companies_house", "manual", "referral"
    discoveredAt: v.number(),
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

    // Signals
    isStealthMode: v.optional(v.boolean()),
    recentlyAnnounced: v.optional(v.boolean()),
    announcementDate: v.optional(v.string()),
    fundingStage: v.optional(v.string()), // pre-seed, seed, series-a
    estimatedFunding: v.optional(v.string()),

    // Scoring
    overallScore: v.optional(v.number()), // 0-100
    teamScore: v.optional(v.number()),
    marketScore: v.optional(v.number()),
    bonusScore: v.optional(v.number()), // For auditability - stealth, recently announced, multiple founders
    tractionScore: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_stage", ["userId", "stage"])
    .index("by_company_number", ["companyNumber"])
    .searchIndex("search_company_name", {
      searchField: "companyName",
      filterFields: ["userId", "stage"],
    }),

  // Founders linked to startups
  founders: defineTable({
    userId: v.string(), // Owner of this record
    startupId: v.optional(v.id("startups")),

    // Basic info
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    linkedInId: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    location: v.optional(v.string()),

    // Role
    role: v.optional(v.string()), // CEO, CTO, Co-founder
    isFounder: v.boolean(),

    // Education - scored for quality
    education: v.optional(v.array(v.object({
      school: v.string(),
      degree: v.optional(v.string()),
      fieldOfStudy: v.optional(v.string()),
      startYear: v.optional(v.number()),
      endYear: v.optional(v.number()),
      isTopTier: v.optional(v.boolean()), // Oxford, Cambridge, Imperial, etc.
    }))),

    // Experience - scored for high-growth companies
    experience: v.optional(v.array(v.object({
      company: v.string(),
      title: v.string(),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      isCurrent: v.optional(v.boolean()),
      isHighGrowth: v.optional(v.boolean()), // Worked at known high-growth company
      description: v.optional(v.string()),
    }))),

    // Scoring
    educationScore: v.optional(v.number()), // 0-100
    experienceScore: v.optional(v.number()), // 0-100
    overallScore: v.optional(v.number()), // 0-100

    // Sourcing metadata
    source: v.string(), // "linkedin", "manual", "companies_house"
    discoveredAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_startup", ["userId", "startupId"])
    .index("by_linkedin_id", ["linkedInId"])
    .searchIndex("search_founder_name", {
      searchField: "firstName",
      filterFields: ["userId"],
    }),

  // Outreach tracking for emails and LinkedIn
  outreach: defineTable({
    userId: v.string(),
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),

    // Type of outreach
    type: v.union(v.literal("email"), v.literal("linkedin")),

    // Status tracking
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("replied"),
      v.literal("bounced"),
      v.literal("failed")
    ),

    // Content
    subject: v.optional(v.string()), // For emails
    message: v.string(),
    template: v.optional(v.string()), // Template name if used

    // Timing
    createdAt: v.number(),
    scheduledFor: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),

    // Response
    response: v.optional(v.string()),
    sentiment: v.optional(v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative")
    )),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_founder", ["founderId"]),

  // VC connections for introductions
  vcConnections: defineTable({
    userId: v.string(),

    // VC info
    vcName: v.string(),
    firmName: v.string(),
    email: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
    website: v.optional(v.string()),

    // Focus areas
    investmentStages: v.optional(v.array(v.string())), // pre-seed, seed, series-a
    sectors: v.optional(v.array(v.string())), // fintech, healthtech, etc.
    checkSize: v.optional(v.string()), // "$250k-$2m"

    // Partner emails (multiple contacts per firm)
    partnerEmails: v.optional(v.array(v.object({
      name: v.string(),
      email: v.string(),
      role: v.optional(v.string()),
      linkedInUrl: v.optional(v.string()),
      emailVerified: v.optional(v.boolean()),
      emailSource: v.optional(v.string()),
    }))),

    // Portfolio companies for validation & conflict detection
    portfolioCompanies: v.optional(v.array(v.object({
      name: v.string(),
      sector: v.optional(v.string()),
      stage: v.optional(v.string()),
      investmentDate: v.optional(v.string()),
      url: v.optional(v.string()),
    }))),

    // Discovery metadata
    discoveredFrom: v.optional(v.string()),
    discoveredAt: v.optional(v.number()),

    // Validation & activity scoring
    activityScore: v.optional(v.number()),
    validationStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("needs_review"),
      v.literal("rejected")
    )),
    validationErrors: v.optional(v.array(v.string())),
    lastActivityDate: v.optional(v.number()),

    // Relationship
    relationshipStrength: v.union(
      v.literal("weak"),
      v.literal("moderate"),
      v.literal("strong")
    ),
    lastContactDate: v.optional(v.number()),
    notes: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_validation_status", ["userId", "validationStatus"])
    .searchIndex("search_vc_name", {
      searchField: "vcName",
      filterFields: ["userId"],
    })
    .searchIndex("search_firm_name", {
      searchField: "firmName",
      filterFields: ["userId"],
    }),

  // Introduction tracking between startups and VCs
  introductions: defineTable({
    userId: v.string(),
    startupId: v.id("startups"),
    vcConnectionId: v.id("vcConnections"),
    founderId: v.optional(v.id("founders")),

    status: v.union(
      v.literal("considering"),
      v.literal("preparing"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("meeting_scheduled"),
      v.literal("passed"),
      v.literal("invested")
    ),

    // Timing
    createdAt: v.number(),
    introducedAt: v.optional(v.number()),
    meetingDate: v.optional(v.number()),

    // Outcome
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_startup", ["startupId"])
    .index("by_vc_connection", ["vcConnectionId"]),

  // Email/outreach templates
  templates: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal("email"), v.literal("linkedin")),
    subject: v.optional(v.string()),
    body: v.string(),
    variables: v.optional(v.array(v.string())), // ["firstName", "companyName"]
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "type"]),

  // API keys and settings
  userSettings: defineTable({
    userId: v.string(),

    // Companies House API
    companiesHouseApiKey: v.optional(v.string()),

    // Email settings (e.g., SendGrid, Resend)
    emailApiKey: v.optional(v.string()),
    emailProvider: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    emailFromName: v.optional(v.string()),

    // LinkedIn settings (for manual tracking)
    linkedInProfileUrl: v.optional(v.string()),

    // Exa.ai API key for LinkedIn enrichment
    exaApiKey: v.optional(v.string()),

    // VC Discovery API keys
    apolloApiKey: v.optional(v.string()), // Primary: Apollo.io for emails
    hunterApiKey: v.optional(v.string()),
    rocketReachApiKey: v.optional(v.string()),
    zeroBouncApiKey: v.optional(v.string()),
    crunchbaseApiKey: v.optional(v.string()),

    // Preferences
    defaultOutreachTemplate: v.optional(v.id("templates")),
    autoScoreFounders: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // High-growth companies reference list for scoring
  highGrowthCompanies: defineTable({
    userId: v.string(),
    companyName: v.string(),
    category: v.optional(v.string()), // "unicorn", "decacorn", "yc", "tier1_vc_backed"
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_company", {
      searchField: "companyName",
      filterFields: ["userId"],
    }),

  // Top universities reference list for scoring
  topUniversities: defineTable({
    userId: v.string(),
    universityName: v.string(),
    tier: v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3")),
    country: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_university", {
      searchField: "universityName",
      filterFields: ["userId"],
    }),

  // Job tracking for background tasks
  jobRuns: defineTable({
    userId: v.string(),
    jobType: v.union(
      v.literal("discovery"),
      v.literal("enrichment"),
      v.literal("outreach")
    ),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Progress tracking
    itemsProcessed: v.number(),
    itemsTotal: v.optional(v.number()),
    itemsFailed: v.number(),

    // Results summary
    results: v.optional(v.any()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "jobType"])
    .index("by_status", ["status"]),

  // Rate limit tracking
  rateLimits: defineTable({
    userId: v.string(),
    apiName: v.string(), // "companies_house", "exa", "resend"
    windowStart: v.number(), // Start of the rate limit window
    requestCount: v.number(),
    lastRequestAt: v.number(),
  })
    .index("by_user_and_api", ["userId", "apiName"]),

  // Outreach queue for automated sending
  outreachQueue: defineTable({
    userId: v.string(),
    founderId: v.id("founders"),
    startupId: v.optional(v.id("startups")),

    // Outreach details
    type: v.union(v.literal("email"), v.literal("linkedin")),
    subject: v.optional(v.string()),
    message: v.string(),

    // Queue status
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed")
    ),
    priority: v.number(), // Lower = higher priority
    scheduledFor: v.number(), // When to send

    // Retry tracking
    attempts: v.number(),
    maxAttempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),

    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_scheduled", ["status", "scheduledFor"]),

  // VC Discovery tracking
  vcDiscoveryLog: defineTable({
    userId: v.string(),

    // Run metadata
    runId: v.string(),
    runType: v.union(v.literal("scheduled"), v.literal("manual")),
    source: v.string(),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Results
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    vcsFound: v.number(),
    vcsImported: v.number(),
    vcsFlagged: v.number(),
    vcsSkipped: v.number(),

    // Details
    importedVcIds: v.optional(v.array(v.id("vcConnections"))),
    flaggedVcIds: v.optional(v.array(v.id("vcConnections"))),
    errors: v.optional(v.array(v.string())),

    // Raw data for debugging
    rawResults: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_run_id", ["runId"])
    .index("by_status", ["status"]),
});
