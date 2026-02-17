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
): Promise<{ startupsProcessed: number; foundersEnriched: number; emailsFound: number }> {
  // Get user settings for Apollo API key
  const settings = await ctx.runQuery(internal.backgroundJobsDb.getUserSettings, { userId });

  // Get startups needing enrichment
  const startups = await ctx.runQuery(internal.autoSourcingHelpers.getStartupsNeedingEnrichment, {
    userId,
    limit,
  });

  let startupsProcessed = 0;
  let foundersEnriched = 0;
  let emailsFound = 0;

  for (const startup of startups) {
    const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
      startupId: startup._id,
    });

    let startupStealthFromLinkedIn = false;
    let startupRecentlyAnnounced = false;

    for (const founder of founders) {
      // Skip if already fully enriched (has LinkedIn, score, AND email)
      if (founder.linkedInUrl && founder.overallScore && founder.email) continue;

      try {
        // --- Step 1: LinkedIn enrichment via Exa ---
        if (!founder.linkedInUrl || !founder.overallScore) {
          await ctx.runMutation(internal.jobHelpers.recordApiRequest, {
            userId,
            apiName: "exa",
          });

          const nameQuery = `${founder.firstName} ${founder.lastName}`;
          const searchQuery = startup.companyName
            ? `${nameQuery} ${startup.companyName} site:linkedin.com/in`
            : `${nameQuery} site:linkedin.com/in`;
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
            continue;
          }

          const data = await response.json();
          // Find the best match — verify profile text contains the person's name
          const firstLower = founder.firstName.toLowerCase();
          const lastLower = founder.lastName.toLowerCase();

          const linkedInResult = data.results?.find((r: { url: string; text?: string }) => {
            if (!r.url.includes("linkedin.com/in/")) return false;
            const text = (r.text || "").toLowerCase();
            return text.includes(firstLower) && text.includes(lastLower);
          }) || data.results?.find((r: { url: string }) =>
            r.url.includes("linkedin.com/in/")
          );

          if (linkedInResult) {
            const profileData = parseLinkedInContent(linkedInResult.url, linkedInResult.text || "");
            const scores = calculateFounderScore(profileData);

            await ctx.runMutation(internal.autoSourcingHelpers.updateFounderEnriched, {
              founderId: founder._id,
              linkedInData: profileData,
              scores,
            });

            foundersEnriched++;

            // Track stealth signals
            if (profileData.isStealthMode) startupStealthFromLinkedIn = true;
            if (profileData.isRecentlyAnnounced) startupRecentlyAnnounced = true;
          }

          await sleep(1000);
        }

        // --- Step 2: GitHub profile discovery via Exa ---
        if (!founder.githubUrl) {
          const githubData = await searchGitHubProfileBg(exaApiKey, founder.firstName, founder.lastName);
          if (githubData) {
            await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
              founderId: founder._id,
              githubUrl: githubData.url,
              githubUsername: githubData.username,
              githubRepos: githubData.repos,
              githubBio: githubData.bio,
            });
          }
          await sleep(500);
        }

        // --- Step 3: Twitter/X profile discovery via Exa ---
        if (!founder.twitterUrl) {
          const twitterData = await searchTwitterProfileBg(exaApiKey, founder.firstName, founder.lastName);
          if (twitterData) {
            await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
              founderId: founder._id,
              twitterUrl: twitterData.url,
              twitterHandle: twitterData.handle,
              twitterBio: twitterData.bio,
            });
          }
          await sleep(500);
        }

        // --- Step 4: Email discovery via Apollo People Match ---
        if (!founder.email && settings?.apolloApiKey) {
          const email = await discoverFounderEmail(
            founder.firstName,
            founder.lastName,
            startup.companyName,
            founder.linkedInUrl,
            settings.apolloApiKey,
            settings.hunterApiKey,
          );

          if (email) {
            await ctx.runMutation(internal.backgroundJobsDb.updateFounderEmail, {
              founderId: founder._id,
              email,
              emailSource: "apollo",
            });
            emailsFound++;
            console.log(`Found email for ${founder.firstName} ${founder.lastName}: ${email}`);
          }

          await sleep(500);
        }
      } catch (error) {
        console.error(`Error enriching founder ${founder._id}:`, error);
      }
    }

    // --- Step 5: Deep company enrichment ---
    const companyInfo = await enrichCompanyDeepBg(exaApiKey, startup.companyName);

    // Update startup with all enriched data
    await ctx.runMutation(internal.autoSourcingHelpers.updateStartupEnriched, {
      startupId: startup._id,
      isStealthFromLinkedIn: startupStealthFromLinkedIn,
      isRecentlyAnnounced: startupRecentlyAnnounced,
      companyInfo: companyInfo ?? undefined,
    });

    startupsProcessed++;

    await ctx.runMutation(internal.jobHelpers.updateJobProgressMutation, {
      jobId,
      itemsProcessed: startupsProcessed,
    });
  }

  return { startupsProcessed, foundersEnriched, emailsFound };
}

// Discover a founder's email using Apollo People Match + Hunter fallback
async function discoverFounderEmail(
  firstName: string,
  lastName: string,
  companyName: string,
  linkedInUrl: string | undefined,
  apolloApiKey: string,
  hunterApiKey?: string,
): Promise<string | null> {
  // 1. Try Apollo People Match (best results with LinkedIn URL)
  try {
    const body: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      organization_name: companyName,
    };
    if (linkedInUrl) {
      body.linkedin_url = linkedInUrl;
    }

    const response = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.person?.email) {
        return data.person.email;
      }
    }
  } catch (error) {
    console.error("Apollo People Match error:", error);
  }

  // 2. Try Hunter email finder if we can guess the domain
  if (hunterApiKey) {
    try {
      // Try to find email by name + company
      const response = await fetch(
        `https://api.hunter.io/v2/email-finder?company=${encodeURIComponent(companyName)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${hunterApiKey}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data?.email) {
          return data.data.email;
        }
      }
    } catch (error) {
      console.error("Hunter email finder error:", error);
    }
  }

  return null;
}

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
  "columbia", "chicago", "wharton", "insead", "london business school",
];

const HIGH_GROWTH_COMPANIES = [
  "google", "meta", "facebook", "amazon", "apple", "microsoft", "netflix",
  "stripe", "revolut", "monzo", "wise", "transferwise", "checkout.com",
  "deliveroo", "uber", "airbnb", "spotify", "klarna", "plaid", "figma",
  "notion", "slack", "zoom", "shopify", "coinbase", "openai", "anthropic",
  "deepmind", "palantir", "snowflake", "databricks", "datadog", "twilio",
  "salesforce", "hubspot", "atlassian", "gitlab", "linkedin", "twitter",
  "mckinsey", "bain", "bcg", "goldman sachs", "morgan stanley", "jp morgan",
];

const TECHNICAL_TITLES = [
  "engineer", "developer", "architect", "programmer", "scientist",
  "researcher", "technical", "tech lead", "machine learning", "data",
  "devops", "sre", "infrastructure", "backend", "frontend", "fullstack",
  "full-stack", "software", "hardware", "systems", "security",
];

const TECHNICAL_DEGREES = [
  "computer science", "computing", "software engineering", "electrical engineering",
  "mathematics", "physics", "machine learning", "artificial intelligence",
  "data science", "engineering", "cs", "meng", "beng",
];

const EXIT_KEYWORDS = [
  "acquired by", "acquisition", "acquired", "exit", "exited",
  "ipo", "went public", "sold to", "merged with", "successful exit",
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fintech: ["fintech", "payment", "banking", "finance", "trading", "lending", "crypto"],
  ai: ["artificial intelligence", "machine learning", "deep learning", "nlp", "ai", "neural", "llm"],
  saas: ["saas", "b2b", "enterprise software", "platform", "subscription", "cloud software"],
  healthtech: ["health", "medical", "clinical", "biotech", "pharma", "healthcare", "genomics"],
  ecommerce: ["ecommerce", "e-commerce", "retail", "marketplace", "commerce", "dtc"],
  cybersecurity: ["security", "cybersecurity", "infosec", "encryption", "threat"],
  cleantech: ["clean energy", "sustainability", "renewable", "solar", "climate", "carbon"],
};

interface LinkedInProfile {
  linkedInUrl: string;
  headline?: string;
  location?: string;
  isStealthMode?: boolean;
  isRecentlyAnnounced?: boolean;
  stealthSignals?: string[];
  education: Array<{ school: string; degree?: string; fieldOfStudy?: string; startYear?: number; endYear?: number; isTopTier?: boolean }>;
  experience: Array<{ company: string; title: string; startDate?: string; endDate?: string; isCurrent?: boolean; isHighGrowth?: boolean }>;
  // Enrichment signals
  isRepeatFounder?: boolean;
  isTechnicalFounder?: boolean;
  previousExits?: number;
  yearsOfExperience?: number;
  domainExpertise?: string[];
  hasPhd?: boolean;
  hasMba?: boolean;
  enrichmentConfidence?: "high" | "medium" | "low";
}

function parseLinkedInContent(linkedInUrl: string, text: string): LinkedInProfile {
  const textLower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim());

  const stealthKeywords = ["stealth", "building something new", "unannounced", "0 to 1", "pre-launch", "under the radar", "founding team", "zero to one"];
  const announcedKeywords = ["just launched", "announcing", "out of stealth", "coming out of stealth", "excited to announce"];

  const stealthSignals: string[] = [];
  let isStealthMode = false;
  for (const k of stealthKeywords) {
    if (textLower.includes(k)) {
      stealthSignals.push(k);
      isStealthMode = true;
    }
  }
  const isRecentlyAnnounced = announcedKeywords.some((k) => textLower.includes(k));

  let headline = "";
  let location = "";

  for (const line of lines.slice(0, 10)) {
    if (/CEO|CTO|Founder|Co-founder|Director|Engineer|Building/i.test(line) && !headline) {
      headline = line.substring(0, 100);
    }
    if (/London|UK|Manchester|Cambridge|Oxford|Edinburgh|Bristol|Birmingham/i.test(line) && !location) {
      location = line.substring(0, 50);
    }
  }

  // Education with degree and field extraction
  const education: LinkedInProfile["education"] = [];
  const eduKeywords = ["University", "College", "Institute", "School", "MBA", "BSc", "MSc", "PhD", "Bachelor", "Master"];
  let hasPhd = false;
  let hasMba = false;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of eduKeywords) {
      if (line.includes(keyword)) {
        const isTopTier = TOP_TIER_UNIVERSITIES.some((u) => lineLower.includes(u));

        let degree: string | undefined;
        if (lineLower.includes("phd") || lineLower.includes("doctorate") || lineLower.includes("dphil")) {
          degree = "PhD"; hasPhd = true;
        } else if (lineLower.includes("mba")) {
          degree = "MBA"; hasMba = true;
        } else if (lineLower.includes("master") || lineLower.includes("msc") || lineLower.includes("meng")) {
          degree = "Masters";
        } else if (lineLower.includes("bachelor") || lineLower.includes("bsc") || lineLower.includes("beng")) {
          degree = "Bachelors";
        }

        let fieldOfStudy: string | undefined;
        for (const td of TECHNICAL_DEGREES) {
          if (lineLower.includes(td)) { fieldOfStudy = td.charAt(0).toUpperCase() + td.slice(1); break; }
        }

        education.push({ school: line.substring(0, 100), degree, fieldOfStudy, isTopTier });
        break;
      }
    }
  }

  // Experience extraction with title detection
  const experience: LinkedInProfile["experience"] = [];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const company of HIGH_GROWTH_COMPANIES) {
      if (lineLower.includes(company)) {
        let title = "Unknown";
        const titlePatterns = ["engineer", "developer", "manager", "director", "vp", "head", "lead", "founder", "ceo", "cto", "cfo", "co-founder", "cofounder", "principal"];
        for (const pattern of titlePatterns) {
          if (lineLower.includes(pattern)) {
            const idx = lineLower.indexOf(pattern);
            title = line.substring(Math.max(0, idx - 20), idx + pattern.length + 10).trim();
            break;
          }
        }
        experience.push({ company: company.charAt(0).toUpperCase() + company.slice(1), title, isHighGrowth: true });
        break;
      }
    }

    // General company patterns
    const companyPatterns = ["at ", "@ "];
    for (const pattern of companyPatterns) {
      const idx = lineLower.indexOf(pattern);
      if (idx !== -1 && idx < 50) {
        const companyPart = line.substring(idx + pattern.length).trim().split(/[,·\-]/)[0].trim();
        if (companyPart.length > 2 && companyPart.length < 50) {
          const isHighGrowth = HIGH_GROWTH_COMPANIES.some(hg => companyPart.toLowerCase().includes(hg));
          if (!experience.some(e => e.company.toLowerCase() === companyPart.toLowerCase())) {
            experience.push({ company: companyPart, title: line.substring(0, idx).trim() || "Unknown", isHighGrowth });
          }
        }
        break;
      }
    }
  }

  // Repeat founder detection
  const founderTitles = experience.filter(e => /\b(founder|co-founder|cofounder)\b/i.test(e.title));
  const isRepeatFounder = founderTitles.length >= 2;

  // Technical founder detection
  const hasTechnicalDegree = education.some(e => e.fieldOfStudy && TECHNICAL_DEGREES.some(td => e.fieldOfStudy!.toLowerCase().includes(td)));
  const hasTechnicalRole = experience.some(e => TECHNICAL_TITLES.some(tt => e.title.toLowerCase().includes(tt)));
  const isTechnicalFounder = hasTechnicalDegree || hasTechnicalRole;

  // Previous exits detection
  let previousExits = 0;
  for (const keyword of EXIT_KEYWORDS) { if (textLower.includes(keyword)) previousExits++; }
  previousExits = Math.min(previousExits, 5);
  if (founderTitles.length === 0 && previousExits > 0) previousExits = Math.min(previousExits, 1);

  // Years of experience estimation
  let yearsOfExperience: number | undefined;
  const currentYear = new Date().getFullYear();
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    const years = yearMatches.map(Number).filter(y => y >= 1980 && y <= currentYear);
    if (years.length >= 2) {
      const minYear = years.reduce((a, b) => Math.min(a, b));
      yearsOfExperience = currentYear - minYear;
    }
  }

  // Domain expertise detection
  const domainExpertise: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.filter(kw => textLower.includes(kw)).length >= 2) domainExpertise.push(domain);
  }

  // Enrichment confidence
  let enrichmentConfidence: "high" | "medium" | "low" = "low";
  const dataPoints = [headline ? 1 : 0, location ? 1 : 0, education.length > 0 ? 1 : 0, experience.length > 0 ? 1 : 0, experience.length >= 3 ? 1 : 0, education.some(e => e.degree) ? 1 : 0].reduce((a, b) => a + b, 0);
  if (dataPoints >= 5) enrichmentConfidence = "high";
  else if (dataPoints >= 3) enrichmentConfidence = "medium";

  return {
    linkedInUrl,
    headline: headline || undefined,
    location: location || undefined,
    isStealthMode,
    isRecentlyAnnounced,
    stealthSignals: stealthSignals.length > 0 ? stealthSignals : undefined,
    education: education.slice(0, 5),
    experience: experience.slice(0, 10),
    isRepeatFounder,
    isTechnicalFounder,
    previousExits,
    yearsOfExperience,
    domainExpertise: domainExpertise.length > 0 ? domainExpertise : undefined,
    hasPhd,
    hasMba,
    enrichmentConfidence,
  };
}

function calculateFounderScore(profile: LinkedInProfile): {
  educationScore: number;
  experienceScore: number;
  overallScore: number;
  founderTier: "exceptional" | "strong" | "promising" | "standard";
} {
  let educationScore = 0;
  let experienceScore = 0;

  const topTierCount = profile.education.filter((e) => e.isTopTier).length;
  if (topTierCount > 0) {
    educationScore = Math.min(100, 50 + topTierCount * 25);
  } else if (profile.education.length > 0) {
    educationScore = 30;
  }

  // PhD / MBA bonus
  if (profile.hasPhd) educationScore = Math.min(100, educationScore + 15);
  if (profile.hasMba) educationScore = Math.min(100, educationScore + 10);

  const highGrowthCount = profile.experience.filter((e) => e.isHighGrowth).length;
  if (highGrowthCount >= 3) experienceScore = 100;
  else if (highGrowthCount === 2) experienceScore = 80;
  else if (highGrowthCount === 1) experienceScore = 60;
  else if (profile.experience.length > 0) experienceScore = 30;

  // Leadership bonus
  const hasLeadershipRole = profile.experience.some(e =>
    /\b(founder|ceo|cto|head|director)\b/i.test(e.title)
  );
  if (hasLeadershipRole) experienceScore = Math.min(100, experienceScore + 15);

  // Repeat founder bonus
  if (profile.isRepeatFounder) experienceScore = Math.min(100, experienceScore + 15);

  // Previous exit bonus
  if (profile.previousExits && profile.previousExits > 0) experienceScore = Math.min(100, experienceScore + 10);

  // Career depth bonus
  if (profile.yearsOfExperience && profile.yearsOfExperience >= 10) experienceScore = Math.min(100, experienceScore + 5);

  const overallScore = Math.round(educationScore * 0.4 + experienceScore * 0.6);

  // Founder tier
  let founderTier: "exceptional" | "strong" | "promising" | "standard" = "standard";
  if (overallScore >= 80 || (profile.isRepeatFounder && profile.previousExits && profile.previousExits > 0)) {
    founderTier = "exceptional";
  } else if (overallScore >= 65 || (profile.isRepeatFounder && highGrowthCount >= 1)) {
    founderTier = "strong";
  } else if (overallScore >= 45 || highGrowthCount >= 1 || topTierCount >= 1) {
    founderTier = "promising";
  }

  return { educationScore, experienceScore, overallScore, founderTier };
}

// ============ SOCIAL PROFILE DISCOVERY ============

async function searchGitHubProfileBg(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<{ url: string; username: string; repos?: number; bio?: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query: `${firstName} ${lastName} software developer`,
        numResults: 3,
        includeDomains: ["github.com"],
        type: "neural",
        contents: { text: true },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();

    const profileResult = data.results?.find((r: { url: string }) => {
      const match = r.url.match(/github\.com\/([^/]+)\/?$/);
      return match && !["topics", "explore", "trending", "search"].includes(match[1]);
    });

    if (!profileResult) return null;
    const url = profileResult.url;
    const username = url.match(/github\.com\/([^/]+)/)?.[1] || "";
    const text = (profileResult.text || "").toLowerCase();

    let repos: number | undefined;
    const repoMatch = text.match(/(\d+)\s*repositor/i);
    if (repoMatch) repos = parseInt(repoMatch[1]);

    const lines = (profileResult.text || "").split("\n").filter((l: string) => l.trim());
    let bio: string | undefined;
    for (const line of lines.slice(0, 5)) {
      if (line.length > 20 && line.length < 200 && !line.includes("github.com")) {
        bio = line.trim(); break;
      }
    }

    return { url, username, repos, bio };
  } catch (error) { console.error("GitHub profile search error:", error); return null; }
}

async function searchTwitterProfileBg(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<{ url: string; handle: string; bio?: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query: `${firstName} ${lastName} founder startup`,
        numResults: 3,
        includeDomains: ["twitter.com", "x.com"],
        type: "neural",
        contents: { text: true },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();

    const profileResult = data.results?.find((r: { url: string }) =>
      /(?:twitter\.com|x\.com)\/[^/]+\/?$/.test(r.url) &&
      !r.url.includes("/status/") && !r.url.includes("/search")
    );

    if (!profileResult) return null;
    const url = profileResult.url;
    const handle = url.match(/(?:twitter\.com|x\.com)\/([^/]+)/)?.[1] || "";

    const lines = (profileResult.text || "").split("\n").filter((l: string) => l.trim());
    let bio: string | undefined;
    for (const line of lines.slice(0, 5)) {
      if (line.length > 15 && line.length < 200 && !line.includes("twitter.com") && !line.includes("x.com")) {
        bio = line.trim(); break;
      }
    }

    return { url, handle, bio };
  } catch (error) { console.error("Twitter profile search error:", error); return null; }
}

// ============ DEEP COMPANY ENRICHMENT ============

const NEWS_DOMAINS_BG = [
  "techcrunch.com", "sifted.eu", "bloomberg.com", "reuters.com",
  "ft.com", "wired.com", "venturebeat.com", "eu-startups.com",
  "uktech.news", "startups.co.uk", "forbes.com",
];

async function enrichCompanyDeepBg(
  apiKey: string,
  companyName: string
): Promise<{
  description?: string;
  website?: string;
  productDescription?: string;
  businessModel?: string;
  techStack?: string[];
  teamSize?: string;
  newsArticles?: Array<{ title: string; url: string; source?: string; date?: string }>;
  fundingDetails?: Array<{ round?: string; amount?: string; date?: string; investors?: string[] }>;
  crunchbaseUrl?: string;
} | null> {
  try {
    // Parallel Exa searches for different aspects
    const [generalResults, newsResults, fundingResults] = await Promise.all([
      exaSearchBg(apiKey, `"${companyName}" startup`, 5),
      exaSearchBg(apiKey, `"${companyName}" startup news announcement`, 5, NEWS_DOMAINS_BG),
      exaSearchBg(apiKey, `"${companyName}" funding raised investment`, 5),
    ]);

    const result: Record<string, unknown> = {};

    // Tech stack keywords
    const TECH_KEYWORDS: Record<string, string> = {
      "react": "React", "next.js": "Next.js", "vue": "Vue.js", "angular": "Angular",
      "node.js": "Node.js", "python": "Python", "typescript": "TypeScript",
      "kubernetes": "Kubernetes", "docker": "Docker", "aws": "AWS",
      "gcp": "Google Cloud", "azure": "Azure", "graphql": "GraphQL",
      "postgresql": "PostgreSQL", "mongodb": "MongoDB", "redis": "Redis",
      "openai": "OpenAI", "pytorch": "PyTorch", "tensorflow": "TensorFlow",
    };

    // Process general results
    const techStack: string[] = [];
    if (generalResults) {
      for (const item of generalResults) {
        const url = item.url || "";
        const text = item.text || "";

        // Find company website
        if (!result.website && url.length > 0 &&
          !url.includes("linkedin") && !url.includes("twitter") && !url.includes("x.com") &&
          !url.includes("crunchbase") && !url.includes("companieshouse") &&
          !NEWS_DOMAINS_BG.some(d => url.includes(d))) {
          result.website = url;
        }

        if (url.includes("crunchbase.com") && !result.crunchbaseUrl) {
          result.crunchbaseUrl = url;
        }

        if (!result.description && text.length > 50) {
          result.description = text.substring(0, 500);
        }

        // Tech stack detection
        const textLower = text.toLowerCase();
        for (const [kw, label] of Object.entries(TECH_KEYWORDS)) {
          if (textLower.includes(kw) && !techStack.includes(label)) techStack.push(label);
        }

        // Business model detection
        if (!result.businessModel && text.length > 30) {
          const tl = text.toLowerCase();
          if (tl.includes("b2b") || tl.includes("enterprise")) result.businessModel = "B2B";
          else if (tl.includes("b2c") || tl.includes("consumer")) result.businessModel = "B2C";
          else if (tl.includes("marketplace")) result.businessModel = "Marketplace";
          else if (tl.includes("d2c") || tl.includes("dtc")) result.businessModel = "DTC";
        }

        // Team size detection
        if (!result.teamSize && text.length > 30) {
          const sizeMatch = text.match(/(\d+)\s*(?:employees?|team\s*members?|people)/i);
          if (sizeMatch) {
            const count = parseInt(sizeMatch[1]);
            if (count >= 1 && count <= 10000) {
              result.teamSize = count <= 10 ? "1-10" : count <= 50 ? "11-50" :
                count <= 200 ? "51-200" : count <= 500 ? "201-500" : "500+";
            }
          }
        }
      }
    }
    if (techStack.length > 0) result.techStack = techStack;

    // Process news
    const newsArticles: Array<{ title: string; url: string; source?: string; date?: string }> = [];
    if (newsResults) {
      for (const item of newsResults) {
        const url = item.url || "";
        const title = item.title || "";
        if (!title && !url) continue;

        let source: string | undefined;
        for (const domain of NEWS_DOMAINS_BG) {
          if (url.includes(domain)) {
            source = domain.split(".")[0];
            source = source.charAt(0).toUpperCase() + source.slice(1);
            break;
          }
        }

        const dateMatch = (item.publishedDate || item.text || "").match(/\d{4}-\d{2}-\d{2}/);
        newsArticles.push({ title: title.substring(0, 200), url, source, date: dateMatch?.[0] });
      }
      if (newsArticles.length > 0) result.newsArticles = newsArticles.slice(0, 5);
    }

    // Process funding
    const fundingDetails: Array<{ round?: string; amount?: string; date?: string; investors?: string[] }> = [];
    if (fundingResults) {
      for (const item of fundingResults) {
        const text = item.text || "";
        if (text.length < 20) continue;

        // Extract funding amounts
        const fundingPatterns = [
          /(?:raised?|secures?|closes?)\s+(?:£|\$|€)(\d+(?:\.\d+)?)\s*(m(?:illion)?|k|bn|billion)?/gi,
          /(?:£|\$|€)(\d+(?:\.\d+)?)\s*(m(?:illion)?|k|bn|billion)?\s+(?:seed|series\s*[a-d]|pre-seed|round|funding)/gi,
        ];

        for (const pattern of fundingPatterns) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const funding: { round?: string; amount?: string; date?: string; investors?: string[] } = {};
            const amountParts = match.slice(1).filter(Boolean);
            if (amountParts.length >= 1) {
              const numStr = amountParts.find(p => /\d/.test(p));
              const suffix = amountParts.find(p => /^(m|k|bn|million|billion)/i.test(p));
              if (numStr) {
                // Preserve original currency symbol from the match
                const currencyMatch = match[0].match(/[£$€]/);
                const currency = currencyMatch ? currencyMatch[0] : "£";
                funding.amount = `${currency}${numStr}${suffix ? suffix.charAt(0).toUpperCase() : "M"}`;
              }
            }

            const roundMatch = text.match(/(pre-seed|seed|series\s*[a-d])/i);
            if (roundMatch) funding.round = roundMatch[1].toLowerCase().replace(/\s+/g, "-");

            const dateMatch = text.match(/\b(20\d{2})\b/);
            if (dateMatch) funding.date = dateMatch[1];

            if (funding.amount || funding.round) fundingDetails.push(funding);
          }
        }

        // Extract investors
        const investorPattern = /(?:led by|from|backed by)\s+([A-Z][a-zA-Z\s&]+(?:Capital|Ventures|Partners|VC|Fund))/gi;
        investorPattern.lastIndex = 0;
        let investorMatch;
        while ((investorMatch = investorPattern.exec(text)) !== null) {
          const name = investorMatch[1].trim();
          if (name.length > 3 && name.length < 60) {
            if (fundingDetails.length > 0) {
              const last = fundingDetails[fundingDetails.length - 1];
              last.investors = [...(last.investors || []), name];
            } else {
              fundingDetails.push({ investors: [name] });
            }
          }
        }
      }

      if (fundingDetails.length > 0) {
        const seen = new Set<string>();
        result.fundingDetails = fundingDetails.filter(f => {
          const key = `${f.round || ""}-${f.amount || ""}`;
          if (seen.has(key) && key !== "-") return false;
          seen.add(key);
          return true;
        }).slice(0, 5);
      }
    }

    // Fetch website content for product description
    if (result.website) {
      try {
        const websiteContent = await exaFetchUrlBg(apiKey, result.website as string);
        if (websiteContent) {
          const paragraphs = websiteContent.text.split("\n").filter((p: string) => p.trim().length > 40);
          if (paragraphs.length > 0) {
            result.productDescription = paragraphs[0].trim().substring(0, 500);
          }
        }
      } catch (error) { console.error("Website fetch error:", error); }
    }

    if (result.description || result.website || result.newsArticles || result.fundingDetails) {
      return result as {
        description?: string;
        website?: string;
        productDescription?: string;
        businessModel?: string;
        techStack?: string[];
        teamSize?: string;
        newsArticles?: Array<{ title: string; url: string; source?: string; date?: string }>;
        fundingDetails?: Array<{ round?: string; amount?: string; date?: string; investors?: string[] }>;
        crunchbaseUrl?: string;
      };
    }

    return null;
  } catch (error) {
    console.error("Error in deep company enrichment:", error);
    return null;
  }
}

async function exaSearchBg(
  apiKey: string,
  query: string,
  numResults: number,
  includeDomains?: string[],
): Promise<Array<{ url: string; text: string; title: string; publishedDate?: string }> | null> {
  try {
    const body: Record<string, unknown> = {
      query, numResults, type: "neural", useAutoprompt: true, contents: { text: true },
    };
    if (includeDomains && includeDomains.length > 0) body.includeDomains = includeDomains;

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.results || null;
  } catch (error) { console.error("Exa search error:", error); return null; }
}

async function exaFetchUrlBg(
  apiKey: string,
  url: string
): Promise<{ text: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ urls: [url], contents: { text: true } }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] || null;
  } catch (error) { console.error("Exa fetch URL error:", error); return null; }
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

// ============ AUTO-QUALIFICATION ============

// SIC code scalability scores for qualification
const SIC_SCALABILITY: Record<string, number> = {
  "62": 90, // Software
  "63": 85, // Data/web
  "72": 95, // R&D/AI
  "64": 90, // Fintech
  "65": 85, // Insurtech
  "66": 80, // Financial services
  "86": 80, // Healthtech
  "85": 80, // Edtech
  "68": 75, // Proptech
  "35": 85, // Cleantech
  "47": 70, // E-commerce
  "58": 75, // Publishing/gaming
  "59": 70, // Media
  "78": 80, // HR tech
};

export const runAutoQualification = internalAction({
  args: {},
  handler: async (ctx) => {
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      try {
        // Get all "researching" startups
        const startups = await ctx.runQuery(internal.backgroundJobsDb.getResearchingStartups, {
          userId: settings.userId,
        });

        if (startups.length === 0) continue;

        let qualified = 0;
        let passed = 0;

        for (const startup of startups) {
          // Get founders for this startup
          const founders = await ctx.runQuery(internal.backgroundJobsDb.getFoundersForStartup, {
            startupId: startup._id,
          });

          // Calculate team score from founder scores
          const founderScores = founders
            .map((f) => f.overallScore)
            .filter((s): s is number => s !== undefined);

          const teamScore = founderScores.length > 0
            ? Math.round(founderScores.reduce((a, b) => a + b, 0) / founderScores.length)
            : 0;

          // Check for strong signals
          const hasTopTierEducation = founders.some((f) =>
            f.education?.some((e) => e.isTopTier)
          );
          const hasHighGrowthExperience = founders.some((f) =>
            f.experience?.some((e) => e.isHighGrowth)
          );
          const hasRepeatFounder = founders.some((f) => f.isRepeatFounder);
          const hasTechnicalFounder = founders.some((f) => f.isTechnicalFounder);
          const hasExceptionalFounder = founders.some((f) => f.founderTier === "exceptional");
          const isStealth = startup.isStealthMode;
          const isRecentlyAnnounced = startup.recentlyAnnounced;

          // Calculate SIC scalability score
          const sicCodes = startup.sicCodes ?? [];
          let maxScalability = 0;
          for (const sic of sicCodes) {
            const prefix = sic.substring(0, 2);
            if (SIC_SCALABILITY[prefix] && SIC_SCALABILITY[prefix] > maxScalability) {
              maxScalability = SIC_SCALABILITY[prefix];
            }
          }
          const marketScore = maxScalability;

          // Use traction score from enrichment if available
          const tractionScore = startup.tractionScore ?? 0;

          // Overall startup score (weighted) — now includes traction and richer signals
          const overallScore = Math.round(
            teamScore * 0.40 + // 40% team quality
            marketScore * 0.25 + // 25% market/scalability
            tractionScore * 0.15 + // 15% traction signals (new)
            (isStealth ? 5 : 0) + // Stealth bonus
            (isRecentlyAnnounced ? 3 : 0) + // Recently announced bonus
            (hasTopTierEducation ? 3 : 0) + // Top-tier edu bonus
            (hasRepeatFounder ? 5 : 0) + // Repeat founder bonus (new)
            (hasTechnicalFounder ? 2 : 0) + // Technical founder bonus (new)
            (hasExceptionalFounder ? 5 : 0) // Exceptional tier bonus (new)
          );

          // Qualification criteria - intentionally broad to learn through outreach
          const isQualified =
            // At least one founder has been enriched
            founderScores.length > 0 &&
            (
              // Team score is decent
              teamScore >= 35 ||
              // Or has strong individual signals
              hasTopTierEducation ||
              hasHighGrowthExperience ||
              hasRepeatFounder ||
              hasExceptionalFounder ||
              // Or has interesting signals
              isStealth ||
              isRecentlyAnnounced
            ) &&
            // Must be in a scalable sector
            maxScalability >= 65;

          if (isQualified) {
            await ctx.runMutation(internal.backgroundJobsDb.qualifyStartup, {
              startupId: startup._id,
              overallScore,
              teamScore,
              marketScore,
            });
            qualified++;
          } else if (founderScores.length > 0 && maxScalability < 65) {
            // Not in a scalable sector - pass
            await ctx.runMutation(internal.backgroundJobsDb.updateStartupStage, {
              startupId: startup._id,
              stage: "passed",
            });
            passed++;
          }
          // Otherwise leave in "researching" until founders are enriched
        }

        console.log(
          `Auto-qualification for user ${settings.userId}: ` +
          `${qualified} qualified, ${passed} passed, ` +
          `${startups.length - qualified - passed} still researching`
        );
      } catch (error) {
        console.error(`Auto-qualification failed for user ${settings.userId}:`, error);
      }
    }
  },
});

// ============ AUTO-OUTREACH ============

// Personalize template text (same logic as outreachQueue.ts but for internal use)
function personalizeText(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export const runAutoOutreach = internalAction({
  args: {},
  handler: async (ctx) => {
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      if (!settings.emailApiKey) {
        console.log(`Skipping auto-outreach for user ${settings.userId}: no email API key`);
        continue;
      }

      try {
        // Get the default outreach template
        const template = await ctx.runQuery(internal.backgroundJobsDb.getUserDefaultTemplate, {
          userId: settings.userId,
        });

        if (!template) {
          console.log(`Skipping auto-outreach for user ${settings.userId}: no email template`);
          continue;
        }

        // Get qualified startups that haven't been contacted yet
        const startups = await ctx.runQuery(internal.backgroundJobsDb.getQualifiedStartupsNotContacted, {
          userId: settings.userId,
        });

        if (startups.length === 0) continue;

        let outreachQueued = 0;
        let scheduledTime = Date.now();
        const DELAY_BETWEEN_EMAILS = 30 * 60 * 1000; // 30 minutes between emails

        for (const startup of startups.slice(0, 5)) { // Process max 5 startups per run
          // Get founders with emails for this startup
          const founders = await ctx.runQuery(internal.backgroundJobsDb.getFoundersWithEmails, {
            startupId: startup._id,
          });

          if (founders.length === 0) continue;

          let startupOutreachQueued = false;

          for (const founder of founders) {
            // Personalize the template
            const subject = personalizeText(template.subject ?? "Quick intro", {
              firstName: founder.firstName,
              lastName: founder.lastName,
              companyName: startup.companyName,
              senderName: settings.emailFromName || "Robbie",
            });

            const message = personalizeText(template.body, {
              firstName: founder.firstName,
              lastName: founder.lastName,
              companyName: startup.companyName,
              headline: founder.headline ?? "",
              senderName: settings.emailFromName || "Robbie",
            });

            // Queue the outreach
            const queueId = await ctx.runMutation(internal.backgroundJobsDb.queueAutoOutreach, {
              userId: settings.userId,
              founderId: founder._id,
              startupId: startup._id,
              subject,
              message,
              scheduledFor: scheduledTime,
            });

            if (queueId) {
              outreachQueued++;
              startupOutreachQueued = true;
              scheduledTime += DELAY_BETWEEN_EMAILS;
            }
          }

          // Move startup to "contacted" stage if we queued outreach
          if (startupOutreachQueued) {
            await ctx.runMutation(internal.backgroundJobsDb.markStartupContacted, {
              startupId: startup._id,
            });
          }
        }

        console.log(
          `Auto-outreach for user ${settings.userId}: ` +
          `${outreachQueued} emails queued for ${startups.length} qualified startups`
        );
      } catch (error) {
        console.error(`Auto-outreach failed for user ${settings.userId}:`, error);
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

// Auto-match qualified startups with VCs - NOW CREATES INTRODUCTION RECORDS
export const runAutoMatching = internalAction({
  args: {},
  handler: async (ctx) => {
    const usersWithSettings = await ctx.runQuery(internal.backgroundJobsDb.getUsersWithDiscoveryEnabled);

    for (const settings of usersWithSettings) {
      try {
        // Get qualified+ startups (qualified, contacted, or meeting stage)
        const qualifiedStartups = await ctx.runQuery(internal.backgroundJobsDb.getQualifiedStartups, {
          userId: settings.userId,
        });

        // Also get contacted startups for matching
        const contactedStartups = await ctx.runQuery(internal.backgroundJobsDb.getQualifiedStartupsNotContacted, {
          userId: settings.userId,
        });

        const allMatchableStartups = [...qualifiedStartups, ...contactedStartups];

        if (allMatchableStartups.length === 0) continue;

        // Get all VCs for this user
        const vcs = await ctx.runQuery(internal.backgroundJobsDb.getUserVCs, {
          userId: settings.userId,
        });

        if (vcs.length === 0) continue;

        let introsCreated = 0;

        for (const startup of allMatchableStartups) {
          const startupSectors = inferSectorsFromSIC(startup.sicCodes ?? []);
          const startupStage = startup.fundingStage?.toLowerCase() || "pre-seed";

          // Get the best founder for this startup (highest score)
          const founders = await ctx.runQuery(internal.backgroundJobsDb.getFoundersForStartup, {
            startupId: startup._id,
          });
          const bestFounder = founders
            .filter((f) => f.overallScore)
            .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0];

          for (const vc of vcs) {
            // Check if intro already exists
            const existingIntro = await ctx.runQuery(internal.backgroundJobsDb.checkExistingIntroduction, {
              startupId: startup._id,
              vcConnectionId: vc._id,
            });

            if (existingIntro) continue;

            let score = 0;
            const reasons: string[] = [];

            // Stage matching (40 points)
            const vcStages = (vc.investmentStages ?? []).map((s) => s.toLowerCase());
            if (vcStages.includes(startupStage)) {
              score += 40;
              reasons.push(`Stage match: ${startupStage}`);
            }

            // Sector matching (20 points)
            const vcSectors = (vc.sectors ?? []).map((s) => s.toLowerCase());
            for (const sector of startupSectors) {
              if (vcSectors.some((vs) => vs.includes(sector) || sector.includes(vs))) {
                score += 20;
                reasons.push(`Sector match: ${sector}`);
                break;
              }
            }

            // Relationship bonus (25 points max)
            if (vc.relationshipStrength === "strong") {
              score += 25;
              reasons.push("Strong relationship");
            } else if (vc.relationshipStrength === "moderate") {
              score += 15;
              reasons.push("Moderate relationship");
            } else {
              score += 5;
            }

            // Recent contact bonus (10 points)
            if (vc.lastContactDate) {
              const daysSinceContact = (Date.now() - vc.lastContactDate) / (1000 * 60 * 60 * 24);
              if (daysSinceContact < 30) {
                score += 10;
                reasons.push("Recent contact (<30 days)");
              }
            }

            // Startup quality bonus (5 points)
            if (startup.overallScore && startup.overallScore >= 60) {
              score += 5;
              reasons.push(`High quality startup (score: ${startup.overallScore})`);
            }

            // If score is 60+, create an introduction record
            if (score >= 60) {
              await ctx.runMutation(internal.backgroundJobsDb.createAutoIntroduction, {
                userId: settings.userId,
                startupId: startup._id,
                vcConnectionId: vc._id,
                founderId: bestFounder?._id,
                matchScore: score,
                matchReasons: reasons.join(". "),
              });
              introsCreated++;
            }
          }
        }

        console.log(
          `Auto-matching for user ${settings.userId}: ` +
          `${introsCreated} introductions created across ${allMatchableStartups.length} startups`
        );
      } catch (error) {
        console.error(`Auto-matching failed for user ${settings.userId}:`, error);
      }
    }
  },
});
