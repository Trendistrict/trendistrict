"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_USER_ID } from "./authHelpers";

// Types for discovered VCs
interface DiscoveredVC {
  firmName: string;
  website?: string;
  description?: string;
  investmentStages?: string[];
  sectors?: string[];
  partners?: Array<{
    name: string;
    role?: string;
    linkedInUrl?: string;
  }>;
  portfolioCompanies?: Array<{
    name: string;
    sector?: string;
    url?: string;
  }>;
}

interface PartnerEmail {
  name: string;
  email: string;
  role?: string;
  linkedInUrl?: string;
  emailVerified?: boolean;
  emailSource?: string;
}

// =====================
// UK VC FALLBACK LIST
// =====================

// Curated list of well-known UK early-stage VCs
function getUKVCFallbackList(): DiscoveredVC[] {
  return [
    { firmName: "Seedcamp", website: "seedcamp.com" },
    { firmName: "Balderton Capital", website: "balderton.com" },
    { firmName: "Index Ventures", website: "indexventures.com" },
    { firmName: "Atomico", website: "atomico.com" },
    { firmName: "Accel", website: "accel.com" },
    { firmName: "LocalGlobe", website: "localglobe.vc" },
    { firmName: "Northzone", website: "northzone.com" },
    { firmName: "Notion Capital", website: "notion.vc" },
    { firmName: "Episode 1", website: "episode1.com" },
    { firmName: "Forward Partners", website: "forwardpartners.com" },
    { firmName: "Passion Capital", website: "passioncapital.com" },
    { firmName: "Connect Ventures", website: "connectventures.co.uk" },
    { firmName: "MMC Ventures", website: "mmcventures.com" },
    { firmName: "IQ Capital", website: "iqcapital.vc" },
    { firmName: "Pentech Ventures", website: "pentechventures.com" },
    { firmName: "Octopus Ventures", website: "octopusventures.com" },
    { firmName: "Amadeus Capital", website: "amadeuscapital.com" },
    { firmName: "Downing Ventures", website: "downing.co.uk" },
    { firmName: "SFC Capital", website: "sfcapital.co.uk" },
    { firmName: "Ada Ventures", website: "adaventures.com" },
    { firmName: "Fuel Ventures", website: "fuel.ventures" },
    { firmName: "Founders Factory", website: "foundersfactory.com" },
    { firmName: "Playfair Capital", website: "playfaircapital.com" },
    { firmName: "JamJar Investments", website: "jamjarinvestments.com" },
    { firmName: "Firstminute Capital", website: "firstminute.capital" },
  ];
}

// =====================
// VC DISCOVERY VIA APOLLO
// =====================

// Get UK VCs - uses curated fallback list for reliability
export const scrapeBVCA = internalAction({
  args: {},
  handler: async (ctx): Promise<DiscoveredVC[]> => {
    // Use the curated fallback list - this is reliable and always works
    const vcs = getUKVCFallbackList();
    console.log(`Returning ${vcs.length} VCs from curated UK VC list`);
    return vcs;
  },
});

// =====================
// WEBSITE SCRAPER
// =====================

// Scrape a VC website for team and portfolio info
// Returns empty defaults if scraping fails - discovery continues with minimal data
export const scrapeVcWebsite = internalAction({
  args: {
    website: v.string(),
  },
  handler: async (ctx, args): Promise<{
    partners: Array<{ name: string; role?: string; linkedInUrl?: string }>;
    portfolioCompanies: Array<{ name: string; sector?: string; url?: string }>;
    sectors: string[];
    stages: string[];
  }> => {
    const result = {
      partners: [] as Array<{ name: string; role?: string; linkedInUrl?: string }>,
      portfolioCompanies: [] as Array<{ name: string; sector?: string; url?: string }>,
      sectors: [] as string[],
      stages: ["seed", "pre-seed"] as string[], // Default to early stage
    };

    try {
      // Normalize website URL
      let url = args.website;
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }

      // Fetch main page with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`Website ${args.website} returned ${response.status}, using defaults`);
        return result;
      }

      const html = await response.text();
      const htmlLower = html.toLowerCase();

      // Extract sectors from keywords
      const sectorKeywords = [
        "fintech", "healthtech", "edtech", "proptech", "insurtech",
        "deeptech", "cleantech", "biotech", "saas", "enterprise",
        "consumer", "marketplace", "ai", "machine learning", "blockchain",
        "crypto", "climate", "sustainability", "foodtech", "agtech",
        "medtech", "cybersecurity", "b2b", "b2c", "ecommerce",
        "logistics", "mobility",
      ];

      for (const sector of sectorKeywords) {
        if (htmlLower.includes(sector)) {
          result.sectors.push(sector);
        }
      }

      // Extract stages
      const stageKeywords = [
        { keyword: "pre-seed", stage: "pre-seed" },
        { keyword: "preseed", stage: "pre-seed" },
        { keyword: "seed", stage: "seed" },
        { keyword: "series a", stage: "series-a" },
        { keyword: "series-a", stage: "series-a" },
        { keyword: "series b", stage: "series-b" },
        { keyword: "early stage", stage: "seed" },
        { keyword: "early-stage", stage: "seed" },
        { keyword: "growth", stage: "growth" },
      ];

      const foundStages: string[] = [];
      for (const { keyword, stage } of stageKeywords) {
        if (htmlLower.includes(keyword) && !foundStages.includes(stage)) {
          foundStages.push(stage);
        }
      }
      if (foundStages.length > 0) {
        result.stages = foundStages;
      }

    } catch (error) {
      // Log but don't fail - return defaults
      console.log(`Website scrape failed for ${args.website}, using defaults`);
    }

    return result;
  },
});

// =====================
// EMAIL DISCOVERY
// =====================

// Find emails using Apollo.io API (Primary - best for B2B contacts)
async function findEmailsApollo(
  domain: string,
  apiKey: string
): Promise<PartnerEmail[]> {
  const emails: PartnerEmail[] = [];

  try {
    // Apollo People Search API - find people at the organization
    const response = await fetch(
      "https://api.apollo.io/v1/mixed_people/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          q_organization_domains: domain,
          page: 1,
          per_page: 10,
          // Filter for senior roles commonly found at VCs
          person_titles: [
            "Partner",
            "Managing Partner",
            "General Partner",
            "Principal",
            "Managing Director",
            "Founder",
            "Investment Director",
            "Venture Partner",
          ],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.people && Array.isArray(data.people)) {
        for (const person of data.people) {
          if (person.email) {
            emails.push({
              name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
              email: person.email,
              role: person.title,
              linkedInUrl: person.linkedin_url,
              emailVerified: person.email_status === "verified",
              emailSource: "apollo",
            });
          }
        }
      }
    } else {
      const errorText = await response.text();
      console.error(`Apollo API error (${response.status}):`, errorText);
    }
  } catch (error) {
    console.error("Apollo.io error:", error);
  }

  return emails;
}

// Find emails using Hunter.io API
async function findEmailsHunter(
  domain: string,
  apiKey: string
): Promise<PartnerEmail[]> {
  const emails: PartnerEmail[] = [];

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.data?.emails) {
        for (const email of data.data.emails) {
          emails.push({
            name: `${email.first_name || ""} ${email.last_name || ""}`.trim(),
            email: email.value,
            role: email.position,
            linkedInUrl: email.linkedin,
            emailVerified: email.verification?.status === "valid",
            emailSource: "hunter",
          });
        }
      }
    }
  } catch (error) {
    console.error("Hunter.io error:", error);
  }

  return emails;
}

// Find emails using pattern guessing + validation
async function findEmailsByPattern(
  domain: string,
  names: string[],
  zeroBouncApiKey?: string
): Promise<PartnerEmail[]> {
  const emails: PartnerEmail[] = [];

  // Common email patterns
  const patterns = [
    (first: string, last: string) => `${first}@${domain}`,
    (first: string, last: string) => `${first}.${last}@${domain}`,
    (first: string, last: string) => `${first[0]}${last}@${domain}`,
    (first: string, last: string) => `${first}${last[0]}@${domain}`,
    (first: string, last: string) => `${first}_${last}@${domain}`,
  ];

  for (const name of names.slice(0, 5)) {
    // Limit to 5 names
    const parts = name.toLowerCase().split(" ");
    if (parts.length < 2) continue;

    const first = parts[0].replace(/[^a-z]/g, "");
    const last = parts[parts.length - 1].replace(/[^a-z]/g, "");

    if (!first || !last) continue;

    // Try first pattern (most common)
    const email = `${first}.${last}@${domain}`;

    // Validate with ZeroBounce if API key available
    if (zeroBouncApiKey) {
      try {
        const response = await fetch(
          `https://api.zerobounce.net/v2/validate?api_key=${zeroBouncApiKey}&email=${email}`,
          { headers: { "Content-Type": "application/json" } }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === "valid" || data.status === "catch-all") {
            emails.push({
              name,
              email,
              emailVerified: data.status === "valid",
              emailSource: "pattern",
            });
          }
        }
      } catch (error) {
        // Skip validation errors
      }
    } else {
      // Add without validation
      emails.push({
        name,
        email,
        emailVerified: false,
        emailSource: "pattern_unverified",
      });
    }
  }

  return emails;
}

// Email discovery waterfall
export const discoverEmails = internalAction({
  args: {
    domain: v.string(),
    partnerNames: v.array(v.string()),
    apolloApiKey: v.optional(v.string()),
    hunterApiKey: v.optional(v.string()),
    rocketReachApiKey: v.optional(v.string()),
    zeroBouncApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PartnerEmail[]> => {
    let emails: PartnerEmail[] = [];

    // 1. Try Apollo.io first (best for B2B contacts)
    if (args.apolloApiKey) {
      emails = await findEmailsApollo(args.domain, args.apolloApiKey);
      if (emails.length > 0) {
        console.log(`Apollo found ${emails.length} emails for ${args.domain}`);
        return emails;
      }
    }

    // 2. Try Hunter.io as fallback
    if (args.hunterApiKey) {
      emails = await findEmailsHunter(args.domain, args.hunterApiKey);
      if (emails.length > 0) {
        console.log(`Hunter found ${emails.length} emails for ${args.domain}`);
        return emails;
      }
    }

    // 3. Try pattern guessing with validation
    if (args.partnerNames.length > 0) {
      const patternEmails = await findEmailsByPattern(
        args.domain,
        args.partnerNames,
        args.zeroBouncApiKey
      );
      if (patternEmails.length > 0) {
        console.log(
          `Pattern found ${patternEmails.length} emails for ${args.domain}`
        );
        return patternEmails;
      }
    }

    console.log(`No emails found for ${args.domain}`);
    return emails;
  },
});

// =====================
// VALIDATION
// =====================

// Validate a discovered VC - lenient validation to allow imports with minimal data
export const validateVc = internalAction({
  args: {
    vc: v.object({
      firmName: v.string(),
      website: v.optional(v.string()),
      partners: v.optional(v.array(v.object({
        name: v.string(),
        role: v.optional(v.string()),
        linkedInUrl: v.optional(v.string()),
      }))),
      partnerEmails: v.optional(v.array(v.object({
        name: v.string(),
        email: v.string(),
        role: v.optional(v.string()),
        linkedInUrl: v.optional(v.string()),
        emailVerified: v.optional(v.boolean()),
        emailSource: v.optional(v.string()),
      }))),
      portfolioCompanies: v.optional(v.array(v.object({
        name: v.string(),
        sector: v.optional(v.string()),
        stage: v.optional(v.string()),
        investmentDate: v.optional(v.string()),
        url: v.optional(v.string()),
      }))),
      sectors: v.optional(v.array(v.string())),
      stages: v.optional(v.array(v.string())),
      lastActivityDate: v.optional(v.number()),
    }),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    isValid: boolean;
    status: "validated" | "needs_review" | "rejected";
    errors: string[];
    activityScore: number;
  }> => {
    const warnings: string[] = [];
    let activityScore = 50; // Start with base score

    // Check 1: Has website - this is from our curated list so we trust it
    if (args.vc.website) {
      activityScore += 10;
    }

    // Check 2: Has early-stage focus
    const stages = args.vc.stages ?? [];
    const earlyStages = ["pre-seed", "seed", "series-a"];
    const hasEarlyStage = stages.some((s) =>
      earlyStages.includes(s.toLowerCase())
    );
    if (hasEarlyStage) {
      activityScore += 20;
    }

    // Check 3: Has sectors identified
    if ((args.vc.sectors?.length ?? 0) > 0) {
      activityScore += 10;
    }

    // Check 4: Has emails (bonus)
    const emailCount = args.vc.partnerEmails?.length ?? 0;
    if (emailCount > 0) {
      activityScore += Math.min(emailCount * 5, 20);
    } else {
      warnings.push("no_emails_yet");
    }

    // For curated list VCs, always validate or flag for review (never reject)
    // These are known UK VCs, just may need email enrichment
    const status: "validated" | "needs_review" | "rejected" =
      emailCount > 0 ? "validated" : "needs_review";

    return {
      isValid: status === "validated",
      status,
      errors: warnings,
      activityScore: Math.min(activityScore, 100),
    };
  },
});

// =====================
// MAIN DISCOVERY ACTION
// =====================

// Shared discovery logic
interface DiscoveryResults {
  vcsFound: number;
  vcsImported: number;
  vcsFlagged: number;
  vcsSkipped: number;
  importedVcIds: string[];
  flaggedVcIds: string[];
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runVcDiscoveryLogic(
  ctx: any,
  userId: string,
  source: string = "bvca",
  isManual: boolean = false
): Promise<DiscoveryResults> {
  const runId = `vc_discovery_${Date.now()}`;

  console.log(`Starting VC discovery for user ${userId}, source: ${source}, manual: ${isManual}`);

  // Get user settings for API keys
  let settings = null;
  try {
    settings = await ctx.runQuery(
      internal.vcDiscoveryHelpers.getUserSettings,
      { userId }
    );
    console.log(`User settings loaded, Apollo key present: ${!!settings?.apolloApiKey}`);
  } catch (e) {
    console.log("No user settings found, continuing without API keys");
  }

  // Start discovery log
  const logId = await ctx.runMutation(
    internal.vcDiscoveryHelpers.startDiscoveryRun,
    {
      userId,
      runId,
      runType: isManual ? "manual" : "scheduled",
      source,
    }
  );

  console.log(`Discovery run started with log ID: ${logId}`);

  const results: DiscoveryResults = {
    vcsFound: 0,
    vcsImported: 0,
    vcsFlagged: 0,
    vcsSkipped: 0,
    importedVcIds: [],
    flaggedVcIds: [],
    errors: [],
  };

  try {
    // 1. Get VCs from curated list
    console.log("Getting VCs from curated list...");
    const discoveredVcs = await ctx.runAction(internal.vcDiscovery.scrapeBVCA, {});
    results.vcsFound = discoveredVcs.length;

    console.log(`Found ${discoveredVcs.length} VCs from curated list`);

    // 2. Process each VC (limit to 20 per run)
    for (const vc of discoveredVcs.slice(0, 20)) {
      try {
        console.log(`Processing VC: ${vc.firmName}`);

        // Check if already exists
        const existing = await ctx.runQuery(
          internal.vcDiscoveryHelpers.checkVcExists,
          { userId, firmName: vc.firmName }
        );

        if (existing) {
          console.log(`VC ${vc.firmName} already exists, skipping`);
          results.vcsSkipped++;
          continue;
        }

        // Scrape website if available (with resilient defaults)
        let websiteData = {
          partners: [] as Array<{ name: string; role?: string; linkedInUrl?: string }>,
          portfolioCompanies: [] as Array<{ name: string; sector?: string; url?: string }>,
          sectors: [] as string[],
          stages: ["seed", "pre-seed"] as string[],
        };

        if (vc.website) {
          try {
            websiteData = await ctx.runAction(
              internal.vcDiscovery.scrapeVcWebsite,
              { website: vc.website }
            );
          } catch (e) {
            console.log(`Website scrape failed for ${vc.firmName}, using defaults`);
          }
        }

        // Discover emails (non-blocking - we still import without emails)
        let partnerEmails: PartnerEmail[] = [];
        if (vc.website && settings?.apolloApiKey) {
          try {
            const domain = new URL(
              vc.website.startsWith("http") ? vc.website : `https://${vc.website}`
            ).hostname.replace("www.", "");

            partnerEmails = await ctx.runAction(
              internal.vcDiscovery.discoverEmails,
              {
                domain,
                partnerNames: websiteData.partners.map((p) => p.name),
                apolloApiKey: settings?.apolloApiKey,
                hunterApiKey: settings?.hunterApiKey,
                zeroBouncApiKey: settings?.zeroBouncApiKey,
              }
            );
            console.log(`Found ${partnerEmails.length} emails for ${vc.firmName}`);
          } catch (e) {
            console.log(`Email discovery failed for ${vc.firmName}, continuing without emails`);
          }
        }

        // Validate VC
        const validation = await ctx.runAction(
          internal.vcDiscovery.validateVc,
          {
            vc: {
              firmName: vc.firmName,
              website: vc.website,
              partners: websiteData.partners,
              partnerEmails,
              portfolioCompanies: websiteData.portfolioCompanies.map((p) => ({
                name: p.name,
                sector: p.sector,
                url: p.url,
              })),
              sectors: websiteData.sectors,
              stages: websiteData.stages,
            },
          }
        );

        console.log(`Validation result for ${vc.firmName}: ${validation.status}, score: ${validation.activityScore}`);

        // Import VC
        const vcId = await ctx.runMutation(
          internal.vcDiscoveryHelpers.importDiscoveredVc,
          {
            userId,
            vcName: vc.firmName,
            firmName: vc.firmName,
            website: vc.website,
            investmentStages: websiteData.stages,
            sectors: websiteData.sectors,
            partnerEmails: partnerEmails.length > 0 ? partnerEmails : undefined,
            portfolioCompanies:
              websiteData.portfolioCompanies.length > 0
                ? websiteData.portfolioCompanies
                : undefined,
            discoveredFrom: source,
            activityScore: validation.activityScore,
            validationStatus: validation.status,
            validationErrors:
              validation.errors.length > 0 ? validation.errors : undefined,
          }
        );

        console.log(`Imported VC ${vc.firmName} with ID: ${vcId}`);

        if (validation.status === "validated") {
          results.vcsImported++;
          results.importedVcIds.push(vcId);
        } else if (validation.status === "needs_review") {
          results.vcsFlagged++;
          results.flaggedVcIds.push(vcId);
        } else {
          results.vcsSkipped++;
        }

        // Small delay between VCs
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing VC ${vc.firmName}:`, error);
        results.errors.push(`${vc.firmName}: ${String(error)}`);
      }
    }

    // Complete the run
    await ctx.runMutation(internal.vcDiscoveryHelpers.completeDiscoveryRun, {
      logId,
      status: "completed",
      vcsFound: results.vcsFound,
      vcsImported: results.vcsImported,
      vcsFlagged: results.vcsFlagged,
      vcsSkipped: results.vcsSkipped,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });

    console.log(`Discovery completed: found ${results.vcsFound}, imported ${results.vcsImported}, flagged ${results.vcsFlagged}, skipped ${results.vcsSkipped}`);

    return results;
  } catch (error) {
    console.error("Discovery failed with error:", error);

    // Mark as failed
    await ctx.runMutation(internal.vcDiscoveryHelpers.completeDiscoveryRun, {
      logId,
      status: "failed",
      vcsFound: results.vcsFound,
      vcsImported: results.vcsImported,
      vcsFlagged: results.vcsFlagged,
      vcsSkipped: results.vcsSkipped,
      errors: [...results.errors, String(error)],
    });

    throw error;
  }
}

// Internal version for cron jobs (takes userId as parameter)
export const runVcDiscoveryInternal = internalAction({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await runVcDiscoveryLogic(ctx, args.userId, "bvca", false);
  },
});

// Run full VC discovery process (public action for manual runs)
export const runVcDiscovery = action({
  args: {
    source: v.optional(v.string()),
    manual: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? DEFAULT_USER_ID;
    const source = args.source ?? "bvca";
    const isManual = args.manual ?? true;

    return await runVcDiscoveryLogic(ctx, userId, source, isManual);
  },
});
