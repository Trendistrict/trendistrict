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
// BVCA SCRAPER
// =====================

// Scrape BVCA member directory for UK VCs
export const scrapeBVCA = internalAction({
  args: {},
  handler: async (ctx): Promise<DiscoveredVC[]> => {
    const vcs: DiscoveredVC[] = [];

    try {
      // BVCA member directory page
      const response = await fetch(
        "https://www.bvca.co.uk/Member-Directory",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (!response.ok) {
        console.error("BVCA fetch failed:", response.status);
        return vcs;
      }

      const html = await response.text();

      // Parse member listings - BVCA uses a specific structure
      // Look for member cards with firm names and details
      const memberPattern =
        /<div[^>]*class="[^"]*member[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      const namePattern = /<h[2-4][^>]*>(.*?)<\/h[2-4]>/i;
      const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>/gi;
      const websitePattern = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;

      let match;
      while ((match = memberPattern.exec(html)) !== null) {
        const memberHtml = match[1];
        const nameMatch = namePattern.exec(memberHtml);

        if (nameMatch) {
          const firmName = nameMatch[1].replace(/<[^>]*>/g, "").trim();

          // Extract website if present
          const websiteMatch = websitePattern.exec(memberHtml);

          if (firmName && firmName.length > 2) {
            vcs.push({
              firmName,
              website: websiteMatch ? websiteMatch[0] : undefined,
            });
          }
        }
      }

      // Fallback: Try to find any company-like names if pattern matching fails
      if (vcs.length === 0) {
        // Look for common VC firm patterns in the HTML
        const firmPatterns = [
          /([A-Z][a-zA-Z]+ (?:Capital|Ventures|Partners|Investments|VC))/g,
          /([A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+ (?:Capital|Ventures|Partners))/g,
        ];

        for (const pattern of firmPatterns) {
          let firmMatch;
          while ((firmMatch = pattern.exec(html)) !== null) {
            const name = firmMatch[1].trim();
            if (!vcs.find((v) => v.firmName === name)) {
              vcs.push({ firmName: name });
            }
          }
        }
      }

      console.log(`BVCA: Found ${vcs.length} potential VCs`);
    } catch (error) {
      console.error("BVCA scraping error:", error);
    }

    return vcs;
  },
});

// =====================
// WEBSITE SCRAPER
// =====================

// Scrape a VC website for team and portfolio info
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
      stages: [] as string[],
    };

    try {
      // Normalize website URL
      let url = args.website;
      if (!url.startsWith("http")) {
        url = "https://" + url;
      }

      // Fetch main page
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        return result;
      }

      const html = await response.text();

      // Extract team/partners
      // Look for common team page patterns
      const teamPatterns = [
        /(?:partner|team|people|about)[^>]*>([^<]*(?:Partner|Principal|Associate|Director|Managing)[^<]*)/gi,
        /<(?:h[2-4]|strong|b)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/(?:h[2-4]|strong|b)>/g,
      ];

      // Look for LinkedIn URLs
      const linkedInPattern =
        /linkedin\.com\/in\/([a-zA-Z0-9-]+)/gi;
      let linkedInMatch;
      while ((linkedInMatch = linkedInPattern.exec(html)) !== null) {
        // Try to find associated name nearby
        result.partners.push({
          name: linkedInMatch[1].replace(/-/g, " "),
          linkedInUrl: `https://linkedin.com/in/${linkedInMatch[1]}`,
        });
      }

      // Extract portfolio companies
      // Look for portfolio page links and company names
      const portfolioPatterns = [
        /portfolio[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]+)</gi,
        /<img[^>]*alt="([^"]*)"[^>]*class="[^"]*portfolio/gi,
      ];

      // Look for company names in portfolio section
      const companyPattern = /<(?:h[2-4]|strong|a)[^>]*>([A-Z][a-zA-Z0-9]+(?: [A-Z][a-zA-Z0-9]+)*)<\/(?:h[2-4]|strong|a)>/g;
      let companyMatch;
      const seenCompanies = new Set<string>();

      while ((companyMatch = companyPattern.exec(html)) !== null) {
        const name = companyMatch[1].trim();
        if (
          name.length > 2 &&
          name.length < 50 &&
          !seenCompanies.has(name.toLowerCase()) &&
          !name.match(/^(Home|About|Team|Portfolio|Contact|News|Blog)$/i)
        ) {
          seenCompanies.add(name.toLowerCase());
          result.portfolioCompanies.push({ name });
        }
      }

      // Extract sectors from keywords
      const sectorKeywords = [
        "fintech",
        "healthtech",
        "edtech",
        "proptech",
        "insurtech",
        "deeptech",
        "cleantech",
        "biotech",
        "saas",
        "enterprise",
        "consumer",
        "marketplace",
        "ai",
        "machine learning",
        "blockchain",
        "crypto",
        "climate",
        "sustainability",
        "foodtech",
        "agtech",
        "medtech",
        "cybersecurity",
        "b2b",
        "b2c",
        "ecommerce",
        "logistics",
        "mobility",
      ];

      const htmlLower = html.toLowerCase();
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

      for (const { keyword, stage } of stageKeywords) {
        if (htmlLower.includes(keyword) && !result.stages.includes(stage)) {
          result.stages.push(stage);
        }
      }

      // Limit portfolio companies to 20
      result.portfolioCompanies = result.portfolioCompanies.slice(0, 20);

    } catch (error) {
      console.error(`Error scraping ${args.website}:`, error);
    }

    return result;
  },
});

// =====================
// EMAIL DISCOVERY
// =====================

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
    hunterApiKey: v.optional(v.string()),
    rocketReachApiKey: v.optional(v.string()),
    zeroBouncApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PartnerEmail[]> => {
    let emails: PartnerEmail[] = [];

    // 1. Try Hunter.io first
    if (args.hunterApiKey) {
      emails = await findEmailsHunter(args.domain, args.hunterApiKey);
      if (emails.length > 0) {
        console.log(`Hunter found ${emails.length} emails for ${args.domain}`);
        return emails;
      }
    }

    // 2. Try pattern guessing with validation
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

// Validate a discovered VC
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
    const errors: string[] = [];
    let activityScore = 0;

    // Check 1: Has valid UK website
    if (!args.vc.website) {
      errors.push("missing_website");
    } else if (
      !args.vc.website.includes(".co.uk") &&
      !args.vc.website.includes(".uk") &&
      !args.vc.website.includes(".com") &&
      !args.vc.website.includes(".vc")
    ) {
      errors.push("non_uk_website");
    }

    // Check 2: Has 3+ portfolio companies
    const portfolioCount = args.vc.portfolioCompanies?.length ?? 0;
    if (portfolioCount < 3) {
      errors.push("insufficient_portfolio");
    } else {
      activityScore += Math.min(portfolioCount * 5, 30); // Max 30 points
    }

    // Check 3: Invested in last 24 months
    if (args.vc.lastActivityDate) {
      const monthsAgo =
        (Date.now() - args.vc.lastActivityDate) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo <= 24) {
        activityScore += 30;
      } else {
        errors.push("no_recent_activity");
      }
    } else {
      // Can't verify, partial penalty
      errors.push("unknown_activity");
    }

    // Check 4: Focuses on pre-seed/seed/Series A
    const stages = args.vc.stages ?? [];
    const earlyStages = ["pre-seed", "seed", "series-a"];
    const hasEarlyStage = stages.some((s) =>
      earlyStages.includes(s.toLowerCase())
    );
    if (hasEarlyStage) {
      activityScore += 20;
    } else if (stages.length === 0) {
      errors.push("unknown_stages");
    } else {
      errors.push("late_stage_only");
    }

    // Check 5: Found at least one email
    const emailCount = args.vc.partnerEmails?.length ?? 0;
    if (emailCount === 0) {
      errors.push("no_emails");
    } else {
      activityScore += Math.min(emailCount * 5, 20); // Max 20 points
    }

    // Determine status
    let status: "validated" | "needs_review" | "rejected";

    if (errors.length === 0) {
      status = "validated";
    } else if (
      errors.includes("insufficient_portfolio") &&
      errors.includes("no_emails")
    ) {
      status = "rejected";
    } else if (errors.length <= 2) {
      status = "needs_review";
    } else {
      status = "rejected";
    }

    return {
      isValid: status === "validated",
      status,
      errors,
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

  // Get user settings for API keys
  const settings = await ctx.runQuery(
    internal.vcDiscoveryHelpers.getUserSettings,
    { userId }
  );

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
    // 1. Scrape BVCA for VCs
    console.log("Starting BVCA scrape...");
    const discoveredVcs = await ctx.runAction(internal.vcDiscovery.scrapeBVCA, {});
    results.vcsFound = discoveredVcs.length;

    console.log(`Found ${discoveredVcs.length} VCs from BVCA`);

    // 2. Process each VC (limit to 20 per run)
    for (const vc of discoveredVcs.slice(0, 20)) {
      try {
        // Check if already exists
        const existing = await ctx.runQuery(
          internal.vcDiscoveryHelpers.checkVcExists,
          { userId, firmName: vc.firmName }
        );

        if (existing) {
          results.vcsSkipped++;
          continue;
        }

        // Scrape website if available
        let websiteData = {
          partners: [] as Array<{ name: string; role?: string; linkedInUrl?: string }>,
          portfolioCompanies: [] as Array<{ name: string; sector?: string; url?: string }>,
          sectors: [] as string[],
          stages: [] as string[],
        };

        if (vc.website) {
          websiteData = await ctx.runAction(
            internal.vcDiscovery.scrapeVcWebsite,
            { website: vc.website }
          );
        }

        // Discover emails
        let partnerEmails: PartnerEmail[] = [];
        if (vc.website) {
          const domain = new URL(
            vc.website.startsWith("http") ? vc.website : `https://${vc.website}`
          ).hostname.replace("www.", "");

          partnerEmails = await ctx.runAction(
            internal.vcDiscovery.discoverEmails,
            {
              domain,
              partnerNames: websiteData.partners.map((p) => p.name),
              hunterApiKey: settings?.hunterApiKey,
              zeroBouncApiKey: settings?.zeroBouncApiKey,
            }
          );
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

        // Import VC
        const vcId = await ctx.runMutation(
          internal.vcDiscoveryHelpers.importDiscoveredVc,
          {
            userId,
            vcName: vc.firmName, // Use firm name as VC name initially
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

        if (validation.status === "validated") {
          results.vcsImported++;
          results.importedVcIds.push(vcId);
        } else if (validation.status === "needs_review") {
          results.vcsFlagged++;
          results.flaggedVcIds.push(vcId);
        } else {
          results.vcsSkipped++;
        }

        // Rate limit: wait between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

    return results;
  } catch (error) {
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
