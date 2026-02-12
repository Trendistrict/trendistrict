"use node";

import { internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { sleep, withRetry } from "./lib/rateLimiter";

// Daily limit for startups to discover (split across cron runs)
const DISCOVERY_BATCH_SIZE = 5; // 20/4 runs per day = 5 per run

// ============ SCHEDULED DISCOVERY ============

export const runScheduledDiscovery = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all users with settings configured
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      if (!settings.companiesHouseApiKey) continue;

      // Check if discovery is already running for this user
      const isRunning = await ctx.runQuery(internal.jobHelpers.checkJobRunning, {
        userId: settings.userId,
        jobType: "discovery",
      });

      if (isRunning) {
        console.log(`Discovery already running for user ${settings.userId}, skipping`);
        continue;
      }

      // Check rate limit
      const rateCheck = await ctx.runQuery(internal.jobHelpers.checkRateLimit, {
        userId: settings.userId,
        apiName: "companies_house",
      });

      if (!rateCheck.allowed) {
        console.log(`Rate limited for user ${settings.userId}, retrying later`);
        continue;
      }

      try {
        // Start job
        const jobId = await ctx.runMutation(internal.jobHelpers.startJobRun, {
          userId: settings.userId,
          jobType: "discovery",
          itemsTotal: DISCOVERY_BATCH_SIZE,
        });

        // Run discovery with limited batch
        const result = await runDiscoveryBatch(
          ctx,
          settings.userId,
          settings.companiesHouseApiKey,
          DISCOVERY_BATCH_SIZE,
          jobId
        );

        // Complete job
        await ctx.runMutation(internal.jobHelpers.completeJobMutation, {
          jobId,
          results: result,
        });

        console.log(`Discovery completed for user ${settings.userId}: found ${result.added} startups`);
      } catch (error) {
        console.error(`Discovery failed for user ${settings.userId}:`, error);
      }
    }
  },
});

async function runDiscoveryBatch(
  ctx: ActionCtx,
  userId: string,
  apiKey: string,
  limit: number,
  jobId: Id<"jobRuns">
): Promise<{ found: number; added: number }> {
  const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk";

  // Get SIC codes for tech startups
  const techSicCodes = [
    "62011", "62012", "62020", "62030", "62090", // Software
    "63110", "63120", "63990", // Data/web
    "72190", "72200", // R&D
    "64999", "66190", // Fintech
  ];

  // Search last 90 days for startups
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);

  const fromDateStr = fromDate.toISOString().split("T")[0];
  const toDateStr = toDate.toISOString().split("T")[0];

  const allCompanies: Array<{
    companyNumber: string;
    companyName: string;
    companyStatus: string;
    companyType: string;
    incorporationDate: string;
    sicCodes?: string[];
  }> = [];

  // Search each SIC code with rate limiting
  for (const sicCode of techSicCodes) {
    try {
      // Record API request
      await ctx.runMutation(internal.jobHelpers.recordApiRequest, {
        userId,
        apiName: "companies_house",
      });

      const url = `${COMPANIES_HOUSE_API}/advanced-search/companies?incorporated_from=${fromDateStr}&incorporated_to=${toDateStr}&sic_codes=${sicCode}&size=50&status=active`;

      const response = await withRetry(
        () =>
          fetch(url, {
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
            },
          }),
        { maxAttempts: 3 }
      );

      if (!response.ok) {
        if (response.status === 416) continue; // No results
        if (response.status === 429) {
          console.log("Rate limited by Companies House, stopping batch");
          break;
        }
        continue;
      }

      const data = await response.json();
      const items = data.items ?? [];

      for (const item of items) {
        allCompanies.push({
          companyNumber: item.company_number,
          companyName: item.company_name,
          companyStatus: item.company_status,
          companyType: item.company_type,
          incorporationDate: item.date_of_creation,
          sicCodes: item.sic_codes,
        });
      }

      // Small delay between requests
      await sleep(200);
    } catch (error) {
      console.error(`Error searching SIC ${sicCode}:`, error);
    }
  }

  // Deduplicate
  const uniqueCompanies = Array.from(
    new Map(allCompanies.map((c) => [c.companyNumber, c])).values()
  );

  // Filter for startups
  const filtered = uniqueCompanies.filter(
    (c) =>
      c.companyStatus === "active" &&
      (c.companyType?.includes("ltd") || c.companyType?.includes("private-limited"))
  );

  // Get existing company numbers to avoid duplicates
  const existingNumbers = await ctx.runQuery(
    internal.backgroundJobsDb.getExistingCompanyNumbers,
    { userId }
  );
  const existingSet = new Set(existingNumbers);

  // Filter out already discovered companies
  const newCompanies = filtered.filter((c) => !existingSet.has(c.companyNumber));

  // Add up to limit
  let added = 0;
  for (const company of newCompanies.slice(0, limit)) {
    try {
      // Get officers with rate limiting
      await ctx.runMutation(internal.jobHelpers.recordApiRequest, {
        userId,
        apiName: "companies_house",
      });

      const officersUrl = `${COMPANIES_HOUSE_API}/company/${company.companyNumber}/officers`;
      const officersResponse = await fetch(officersUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
        },
      });

      let officers: Array<{ name: string; role: string }> = [];
      if (officersResponse.ok) {
        const officersData = await officersResponse.json();
        officers = (officersData.items ?? [])
          .filter((o: Record<string, unknown>) => !o.resigned_on)
          .map((o: Record<string, unknown>) => ({
            name: o.name as string,
            role: o.officer_role as string,
          }));
      }

      // Save to database
      await ctx.runMutation(internal.autoSourcingHelpers.saveDiscoveredStartup, {
        userId,
        company: {
          companyNumber: company.companyNumber,
          companyName: company.companyName,
          incorporationDate: company.incorporationDate,
          companyStatus: company.companyStatus,
          companyType: company.companyType,
          sicCodes: company.sicCodes,
        },
        officers,
      });

      added++;

      // Update progress
      await ctx.runMutation(internal.jobHelpers.updateJobProgressMutation, {
        jobId,
        itemsProcessed: added,
      });

      await sleep(300);
    } catch (error) {
      console.error(`Error adding company ${company.companyNumber}:`, error);
    }
  }

  return { found: newCompanies.length, added };
}

// ============ SCHEDULED ENRICHMENT ============

export const runScheduledEnrichment = internalAction({
  args: {},
  handler: async (ctx) => {
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithEnrichmentEnabled);

    for (const settings of usersWithSettings) {
      if (!settings.exaApiKey) continue;

      // Check if enrichment is already running
      const isRunning = await ctx.runQuery(internal.jobHelpers.checkJobRunning, {
        userId: settings.userId,
        jobType: "enrichment",
      });

      if (isRunning) {
        console.log(`Enrichment already running for user ${settings.userId}, skipping`);
        continue;
      }

      // Check rate limit
      const rateCheck = await ctx.runQuery(internal.jobHelpers.checkRateLimit, {
        userId: settings.userId,
        apiName: "exa",
      });

      if (!rateCheck.allowed) {
        console.log(`Exa rate limited for user ${settings.userId}, retrying later`);
        continue;
      }

      try {
        const jobId = await ctx.runMutation(internal.jobHelpers.startJobRun, {
          userId: settings.userId,
          jobType: "enrichment",
        });

        const result = await runEnrichmentBatch(ctx, settings.userId, settings.exaApiKey, 5, jobId);

        await ctx.runMutation(internal.jobHelpers.completeJobMutation, {
          jobId,
          results: result,
        });

        console.log(`Enrichment completed for user ${settings.userId}: enriched ${result.foundersEnriched} founders`);
      } catch (error) {
        console.error(`Enrichment failed for user ${settings.userId}:`, error);
      }
    }
  },
});

async function runEnrichmentBatch(
  ctx: ActionCtx,
  userId: string,
  exaApiKey: string,
  limit: number,
  jobId: Id<"jobRuns">
): Promise<{ startupsProcessed: number; foundersEnriched: number }> {
  // Get startups needing enrichment
  const startups = await ctx.runQuery(internal.autoSourcingHelpers.getStartupsNeedingEnrichment, {
    userId,
    limit,
  });

  let startupsProcessed = 0;
  let foundersEnriched = 0;

  for (const startup of startups) {
    const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
      startupId: startup._id,
    });

    let foundersAttempted = 0;
    let foundersEnrichedThisStartup = 0;
    let foundersSkipped = 0;

    for (const founder of founders) {
      // Skip if already enriched
      if (founder.linkedInUrl && founder.overallScore) {
        foundersSkipped++;
        continue;
      }

      foundersAttempted++;

      try {
        // Record API request
        await ctx.runMutation(internal.jobHelpers.recordApiRequest, {
          userId,
          apiName: "exa",
        });

        // Search LinkedIn via Exa
        const searchQuery = `${founder.firstName} ${founder.lastName} site:linkedin.com/in`;
        const response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": exaApiKey,
          },
          body: JSON.stringify({
            query: searchQuery,
            numResults: 3,
            includeDomains: ["linkedin.com"],
            type: "neural",
            contents: { text: true },
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.log("Exa rate limited, stopping batch");
            break;
          }
          console.log(`Exa API error for ${founder.firstName} ${founder.lastName}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const linkedInResult = data.results?.find((r: { url: string }) =>
          r.url.includes("linkedin.com/in/")
        );

        if (linkedInResult) {
          // Parse profile and calculate scores
          const profileData = parseLinkedInContent(linkedInResult.url, linkedInResult.text || "");
          const scores = calculateFounderScore(profileData);

          await ctx.runMutation(internal.autoSourcingHelpers.updateFounderEnriched, {
            founderId: founder._id,
            linkedInData: profileData,
            scores,
          });

          foundersEnriched++;
          foundersEnrichedThisStartup++;
          console.log(`Enriched founder: ${founder.firstName} ${founder.lastName} (score: ${scores.overallScore})`);
        } else {
          // IMPORTANT: Log when LinkedIn profile not found - this was a silent failure before
          console.log(`No LinkedIn profile found for: ${founder.firstName} ${founder.lastName} (${data.results?.length || 0} results returned)`);
        }

        await sleep(1000); // Rate limit Exa requests
      } catch (error) {
        console.error(`Error enriching founder ${founder._id}:`, error);
      }

      // Try GitHub enrichment (FREE - no API key needed)
      // This adds technical signals for founders
      try {
        if (!founder.githubUrl) {
          const githubResult = await ctx.runAction(internal.githubEnrichment.enrichFounderWithGitHub, {
            founderId: founder._id,
          });
          if (githubResult.found && githubResult.technicalScore) {
            console.log(`GitHub enriched: ${founder.firstName} ${founder.lastName} (technical score: ${githubResult.technicalScore})`);
          }
          await sleep(6000); // GitHub rate limit: 10 req/min unauthenticated
        }
      } catch (error) {
        // GitHub enrichment is optional, don't fail the whole process
        console.log(`GitHub enrichment skipped for ${founder.firstName} ${founder.lastName}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Log enrichment summary for this startup
    console.log(`Startup ${startup.companyName}: ${foundersEnrichedThisStartup}/${foundersAttempted} founders enriched (${foundersSkipped} already enriched)`);

    // Only move to "researching" stage if we actually attempted and succeeded with some enrichment,
    // OR if all founders were already enriched (skipped), OR if enrichment was attempted
    // This prevents startups from getting stuck if Exa returns no results
    const shouldMoveToResearching = foundersEnrichedThisStartup > 0 || foundersSkipped > 0 || foundersAttempted > 0;

    if (shouldMoveToResearching) {
      await ctx.runMutation(internal.backgroundJobsDb.updateStartupStage, {
        startupId: startup._id,
        stage: "researching",
      });
    } else {
      console.log(`Startup ${startup.companyName} staying in 'discovered' - no founders to enrich`);
    }

    startupsProcessed++;

    await ctx.runMutation(internal.jobHelpers.updateJobProgressMutation, {
      jobId,
      itemsProcessed: startupsProcessed,
    });
  }

  // After enrichment, run qualification on the enriched startups
  try {
    const qualResult = await ctx.runAction(internal.startupQualification.qualifyAllPending, {
      userId, // Fix: Pass userId to ensure qualification runs for the correct user
    });
    console.log(`Post-enrichment qualification for ${userId}: ${qualResult.qualified} qualified, ${qualResult.passed} passed`);
  } catch (error) {
    console.error("Post-enrichment qualification failed:", error);
  }

  return { startupsProcessed, foundersEnriched };
}

// ============ SCHEDULED QUALIFICATION ============

export const runScheduledQualification = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get users who have auto-qualification enabled
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithQualificationEnabled);

    for (const settings of usersWithSettings) {
      try {
        console.log(`Running qualification for user ${settings.userId}...`);

        const result = await ctx.runAction(internal.startupQualification.qualifyAllPending, {
          userId: settings.userId,
        });

        console.log(
          `Qualification completed for user ${settings.userId}: ` +
          `${result.processed} processed, ${result.qualified} qualified, ` +
          `${result.passed} passed, ${result.needsResearch} needs research`
        );
      } catch (error) {
        console.error(`Qualification failed for user ${settings.userId}:`, error);
      }
    }
  },
});

// ============ OUTREACH QUEUE PROCESSING ============

export const processOutreachQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all pending outreach items that are due
    const pendingItems = await ctx.runQuery(internal.backgroundJobsDb.getPendingOutreach);

    for (const item of pendingItems) {
      // Only send one email per user per run to avoid spam
      const isRunning = await ctx.runQuery(internal.jobHelpers.checkJobRunning, {
        userId: item.userId,
        jobType: "outreach",
      });

      if (isRunning) continue;

      // Get user's email settings
      const settings = await ctx.runQuery(internal.backgroundJobsDb.getUserSettings, {
        userId: item.userId,
      });

      if (!settings?.emailApiKey || item.type !== "email") {
        console.log(`Skipping outreach ${item._id}: no email configured or not email type`);
        continue;
      }

      try {
        // Mark as sending
        await ctx.runMutation(internal.backgroundJobsDb.updateOutreachQueueStatus, {
          queueId: item._id,
          status: "sending",
        });

        // Get founder's email
        const founder = await ctx.runQuery(internal.backgroundJobsDb.getFounderById, {
          founderId: item.founderId,
        });

        if (!founder?.email) {
          await ctx.runMutation(internal.backgroundJobsDb.updateOutreachQueueStatus, {
            queueId: item._id,
            status: "failed",
            error: "Founder has no email address",
          });
          continue;
        }

        // Send email via Resend
        const emailResult = await sendEmailViaResend(
          settings.emailApiKey,
          {
            from: settings.emailFromAddress || "outreach@trendistrict.com",
            fromName: settings.emailFromName || "Robbie",
            to: founder.email,
            subject: item.subject || "Introduction",
            body: item.message,
          }
        );

        if (emailResult.success) {
          // Mark as sent
          await ctx.runMutation(internal.backgroundJobsDb.markOutreachSent, {
            queueId: item._id,
            founderId: item.founderId,
            startupId: item.startupId,
            subject: item.subject,
            message: item.message,
          });

          console.log(`Email sent to ${founder.email}`);
        } else {
          // Handle failure with retry logic
          const attempts = item.attempts + 1;
          if (attempts >= item.maxAttempts) {
            await ctx.runMutation(internal.backgroundJobsDb.updateOutreachQueueStatus, {
              queueId: item._id,
              status: "failed",
              error: emailResult.error,
            });
          } else {
            // Schedule retry with exponential backoff
            const retryDelay = Math.pow(2, attempts) * 60 * 1000; // 2, 4, 8 minutes
            await ctx.runMutation(internal.backgroundJobsDb.retryOutreach, {
              queueId: item._id,
              error: emailResult.error || "Unknown error",
              nextAttemptAt: Date.now() + retryDelay,
            });
          }
        }
      } catch (error) {
        console.error(`Outreach failed for ${item._id}:`, error);
        await ctx.runMutation(internal.backgroundJobsDb.updateOutreachQueueStatus, {
          queueId: item._id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  },
});

async function sendEmailViaResend(
  apiKey: string,
  email: {
    from: string;
    fromName: string;
    to: string;
    subject: string;
    body: string;
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${email.fromName} <${email.from}>`,
        to: [email.to],
        subject: email.subject,
        text: email.body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Resend error: ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============ CLEANUP ============

export const cleanupOldRecords = internalAction({
  args: {},
  handler: async (ctx) => {
    // Cleanup old job records for all users
    const allJobs = await ctx.runQuery(internal.backgroundJobsDb.getAllOldJobs);

    for (const job of allJobs) {
      await ctx.runMutation(internal.backgroundJobsDb.deleteJob, { jobId: job._id });
    }

    console.log(`Cleaned up ${allJobs.length} old job records`);
  },
});

// ============ LINKEDIN PARSING ============

const TOP_TIER_UNIVERSITIES = [
  "oxford", "cambridge", "imperial", "ucl", "lse", "stanford", "mit", "harvard",
  "yale", "princeton", "berkeley", "carnegie mellon", "eth zurich", "caltech",
];

const HIGH_GROWTH_COMPANIES = [
  "google", "meta", "facebook", "amazon", "apple", "microsoft", "netflix",
  "stripe", "revolut", "monzo", "wise", "deliveroo", "uber", "airbnb",
  "spotify", "klarna", "openai", "anthropic", "deepmind", "figma", "notion",
];

interface LinkedInProfile {
  linkedInUrl: string;
  headline?: string;
  location?: string;
  isStealthMode?: boolean;
  isRecentlyAnnounced?: boolean;
  education: Array<{ school: string; isTopTier?: boolean }>;
  experience: Array<{ company: string; title: string; isHighGrowth?: boolean }>;
}

function parseLinkedInContent(linkedInUrl: string, text: string): LinkedInProfile {
  const textLower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim());

  const stealthKeywords = ["stealth", "building something new", "unannounced", "0 to 1"];
  const announcedKeywords = ["just launched", "announcing", "out of stealth"];

  const isStealthMode = stealthKeywords.some((k) => textLower.includes(k));
  const isRecentlyAnnounced = announcedKeywords.some((k) => textLower.includes(k));

  let headline = "";
  let location = "";

  for (const line of lines.slice(0, 10)) {
    if (/CEO|CTO|Founder|Director|Engineer|Building/i.test(line) && !headline) {
      headline = line.substring(0, 100);
    }
    if (/London|UK|Manchester|Cambridge|Oxford/i.test(line) && !location) {
      location = line.substring(0, 50);
    }
  }

  const education: LinkedInProfile["education"] = [];
  const eduKeywords = ["University", "College", "Institute", "MBA", "PhD"];

  for (const line of lines) {
    for (const keyword of eduKeywords) {
      if (line.includes(keyword)) {
        const isTopTier = TOP_TIER_UNIVERSITIES.some((u) => line.toLowerCase().includes(u));
        education.push({ school: line.substring(0, 100), isTopTier });
        break;
      }
    }
  }

  const experience: LinkedInProfile["experience"] = [];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const company of HIGH_GROWTH_COMPANIES) {
      if (lineLower.includes(company)) {
        experience.push({
          company: company.charAt(0).toUpperCase() + company.slice(1),
          title: "Unknown",
          isHighGrowth: true,
        });
        break;
      }
    }
  }

  return {
    linkedInUrl,
    headline: headline || undefined,
    location: location || undefined,
    isStealthMode,
    isRecentlyAnnounced,
    education: education.slice(0, 5),
    experience: experience.slice(0, 10),
  };
}

function calculateFounderScore(profile: LinkedInProfile): {
  educationScore: number;
  experienceScore: number;
  overallScore: number;
} {
  let educationScore = 0;
  let experienceScore = 0;

  const topTierCount = profile.education.filter((e) => e.isTopTier).length;
  if (topTierCount > 0) {
    educationScore = Math.min(100, 50 + topTierCount * 25);
  } else if (profile.education.length > 0) {
    educationScore = 30;
  }

  const highGrowthCount = profile.experience.filter((e) => e.isHighGrowth).length;
  if (highGrowthCount >= 3) experienceScore = 100;
  else if (highGrowthCount === 2) experienceScore = 80;
  else if (highGrowthCount === 1) experienceScore = 60;
  else if (profile.experience.length > 0) experienceScore = 30;

  const overallScore = Math.round(educationScore * 0.4 + experienceScore * 0.6);

  return { educationScore, experienceScore, overallScore };
}

// ============ SCHEDULED VC DISCOVERY ============

export const runScheduledVcDiscovery = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all users with VC discovery enabled (have Hunter.io API key configured)
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      // Only run for users who have at least one VC discovery API key configured
      if (!settings.apolloApiKey && !settings.hunterApiKey) {
        console.log(`Skipping VC discovery for user ${settings.userId}: no Apollo or Hunter API key`);
        continue;
      }

      try {
        console.log(`Starting VC discovery for user ${settings.userId}`);

        // Run the VC discovery action
        const result = await ctx.runAction(internal.vcDiscovery.runVcDiscoveryInternal, {
          userId: settings.userId,
        });

        console.log(
          `VC Discovery completed for user ${settings.userId}: ` +
          `found ${result.vcsFound}, imported ${result.vcsImported}, ` +
          `flagged ${result.vcsFlagged}, skipped ${result.vcsSkipped}`
        );
      } catch (error) {
        console.error(`VC discovery failed for user ${settings.userId}:`, error);
      }
    }
  },
});

// ============ AUTO VC MATCHING ============

// Helper to infer sectors from SIC codes (for matching)
function inferSectorsFromSIC(sicCodes: string[]): string[] {
  const sectors: string[] = [];

  const sicToSector: Record<string, string> = {
    "62": "software",
    "63": "data",
    "72": "ai",
    "64": "fintech",
    "65": "insurtech",
    "66": "fintech",
    "86": "healthtech",
    "85": "edtech",
    "68": "proptech",
    "35": "cleantech",
    "38": "cleantech",
    "47": "ecommerce",
    "49": "logistics",
    "52": "logistics",
    "14": "fashion",
    "13": "fashion",
    "46": "fashion",
    "74": "fashion",
  };

  const specificSicCodes: Record<string, string> = {
    "1413": "fashion",
    "1414": "fashion",
    "1419": "fashion",
    "1420": "fashion",
    "4642": "fashion",
    "4771": "fashion",
    "4772": "fashion",
    "7410": "fashion",
    "6201": "software",
    "6202": "software",
    "6311": "data",
    "6312": "data",
  };

  for (const sic of sicCodes) {
    const fourDigit = sic.substring(0, 4);
    if (specificSicCodes[fourDigit] && !sectors.includes(specificSicCodes[fourDigit])) {
      sectors.push(specificSicCodes[fourDigit]);
      continue;
    }

    const prefix = sic.substring(0, 2);
    if (sicToSector[prefix] && !sectors.includes(sicToSector[prefix])) {
      sectors.push(sicToSector[prefix]);
    }
  }

  const hasFashion = sectors.includes("fashion");
  const hasTech = sectors.includes("software") || sectors.includes("ecommerce") || sectors.includes("data");
  if (hasFashion && hasTech) {
    sectors.push("fashion-tech");
  }

  return sectors;
}

// Auto-match qualified startups with VCs
export const runAutoMatching = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all users with settings
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      try {
        // Get qualified startups for this user
        const qualifiedStartups = await ctx.runQuery(internal.backgroundJobsDb.getQualifiedStartups, {
          userId: settings.userId,
        });

        if (qualifiedStartups.length === 0) continue;

        // Get all VCs for this user
        const vcs = await ctx.runQuery(internal.backgroundJobsDb.getUserVCs, {
          userId: settings.userId,
        });

        if (vcs.length === 0) continue;

        // Get existing introductions
        const existingIntros = await ctx.runQuery(internal.backgroundJobsDb.getUserIntroductions, {
          userId: settings.userId,
        });

        let matchesFound = 0;

        // Check for high-quality matches (score >= 50)
        for (const startup of qualifiedStartups) {
          const introducedVcIds = new Set(
            existingIntros
              .filter((i) => i.startupId === startup._id)
              .map((i) => i.vcConnectionId)
          );

          const startupSectors = inferSectorsFromSIC(startup.sicCodes ?? []);
          const startupStage = startup.fundingStage?.toLowerCase() || "pre-seed";

          for (const vc of vcs) {
            // Skip if already introduced
            if (introducedVcIds.has(vc._id)) continue;

            let score = 0;

            // Stage matching (40 points)
            const vcStages = (vc.investmentStages ?? []).map((s) => s.toLowerCase());
            if (vcStages.includes(startupStage)) {
              score += 40;
            }

            // Sector matching (20 points)
            const vcSectors = (vc.sectors ?? []).map((s) => s.toLowerCase());
            for (const sector of startupSectors) {
              if (vcSectors.some((vs) => vs.includes(sector) || sector.includes(vs))) {
                score += 20;
                break;
              }
            }

            // Relationship bonus (25 points max)
            if (vc.relationshipStrength === "strong") score += 25;
            else if (vc.relationshipStrength === "moderate") score += 15;
            else score += 5;

            // Recent contact bonus (10 points)
            if (vc.lastContactDate) {
              const daysSinceContact = (Date.now() - vc.lastContactDate) / (1000 * 60 * 60 * 24);
              if (daysSinceContact < 30) score += 10;
            }

            // If score is 60+, it's a strong match
            if (score >= 60) {
              matchesFound++;
            }
          }
        }

        console.log(`Auto-matching for user ${settings.userId}: ${matchesFound} high-quality matches found across ${qualifiedStartups.length} startups`);
      } catch (error) {
        console.error(`Auto-matching failed for user ${settings.userId}:`, error);
      }
    }
  },
});
