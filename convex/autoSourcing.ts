"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Tech/AI SIC codes for filtering innovative startups
const TECH_AI_SIC_CODES = [
  "62011", // Computer programming activities
  "62012", // Business and domestic software development
  "62020", // Information technology consultancy activities
  "62030", // Computer facilities management activities
  "62090", // Other information technology service activities
  "63110", // Data processing, hosting and related activities
  "63120", // Web portals
  "72110", // Research and experimental development on biotechnology
  "72190", // Other R&D on natural sciences and engineering
  "72200", // R&D on social sciences and humanities
];

// Fintech SIC codes
const FINTECH_SIC_CODES = [
  "64209", // Activities of other holding companies
  "64303", // Activities of venture and development capital companies
  "64921", // Credit granting by non-deposit taking finance houses
  "64999", // Financial intermediation not elsewhere classified
  "66190", // Activities auxiliary to financial intermediation
  "66300", // Fund management activities
];

// Companies House API base URL
const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk";

interface CompanySearchResult {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  incorporationDate: string;
  registeredAddress?: string;
  sicCodes?: string[];
}

interface Officer {
  name: string;
  role: string;
  appointedOn?: string;
  nationality?: string;
  occupation?: string;
}

// Main auto-sourcing action - finds new tech startups
export const runAutoSourcing = action({
  args: {
    apiKey: v.string(),
    daysBack: v.optional(v.number()), // How many days back to search
    sicCodeFilter: v.optional(v.array(v.string())), // Custom SIC codes to filter
  },
  handler: async (ctx, args): Promise<{
    found: number;
    added: number;
    companies: Array<{ name: string; number: string; incorporated: string }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const daysBack = args.daysBack ?? 30;
    const sicCodes = args.sicCodeFilter ?? [...TECH_AI_SIC_CODES, ...FINTECH_SIC_CODES];

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const fromDateStr = fromDate.toISOString().split("T")[0];
    const toDateStr = toDate.toISOString().split("T")[0];

    console.log(`Searching for companies incorporated between ${fromDateStr} and ${toDateStr}`);

    const allCompanies: CompanySearchResult[] = [];

    // Search for each SIC code
    for (const sicCode of sicCodes) {
      try {
        const companies = await searchByIncorporationDate(
          args.apiKey,
          fromDateStr,
          toDateStr,
          sicCode
        );
        allCompanies.push(...companies);
      } catch (error) {
        console.error(`Error searching SIC code ${sicCode}:`, error);
      }
    }

    // Deduplicate by company number
    const uniqueCompanies = Array.from(
      new Map(allCompanies.map((c) => [c.companyNumber, c])).values()
    );

    console.log(`Found ${uniqueCompanies.length} unique companies`);

    // Filter for likely startups (private limited companies, recently incorporated)
    const filteredCompanies = uniqueCompanies.filter((company) => {
      // Only active companies
      if (company.companyStatus !== "active") return false;
      // Only private limited companies (typical startup structure)
      if (!company.companyType?.includes("ltd") &&
          !company.companyType?.includes("private-limited")) return false;
      return true;
    });

    // Add companies to database
    const addedCompanies: Array<{ name: string; number: string; incorporated: string }> = [];

    for (const company of filteredCompanies.slice(0, 50)) { // Limit to 50 per run
      try {
        // Get officers (founders/directors)
        const officers = await getCompanyOfficers(args.apiKey, company.companyNumber);

        // Save to database
        await ctx.runMutation(internal.autoSourcingHelpers.saveDiscoveredStartup, {
          userId: identity.subject,
          company: {
            companyNumber: company.companyNumber,
            companyName: company.companyName,
            incorporationDate: company.incorporationDate,
            companyStatus: company.companyStatus,
            companyType: company.companyType,
            registeredAddress: company.registeredAddress,
            sicCodes: company.sicCodes,
          },
          officers,
        });

        addedCompanies.push({
          name: company.companyName,
          number: company.companyNumber,
          incorporated: company.incorporationDate,
        });
      } catch (error) {
        console.error(`Error processing company ${company.companyNumber}:`, error);
      }
    }

    return {
      found: filteredCompanies.length,
      added: addedCompanies.length,
      companies: addedCompanies,
    };
  },
});

// Search Companies House by incorporation date
async function searchByIncorporationDate(
  apiKey: string,
  fromDate: string,
  toDate: string,
  sicCode: string
): Promise<CompanySearchResult[]> {
  const url = `${COMPANIES_HOUSE_API}/advanced-search/companies?incorporated_from=${fromDate}&incorporated_to=${toDate}&sic_codes=${sicCode}&size=100&status=active`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
    },
  });

  if (!response.ok) {
    if (response.status === 416) {
      // No results found
      return [];
    }
    throw new Error(`Companies House API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.items ?? []).map((item: Record<string, unknown>) => ({
    companyNumber: item.company_number as string,
    companyName: item.company_name as string,
    companyStatus: item.company_status as string,
    companyType: item.company_type as string,
    incorporationDate: item.date_of_creation as string,
    registeredAddress: formatAddress(item.registered_office_address as Record<string, unknown>),
    sicCodes: item.sic_codes as string[],
  }));
}

// Get company officers
async function getCompanyOfficers(
  apiKey: string,
  companyNumber: string
): Promise<Officer[]> {
  const url = `${COMPANIES_HOUSE_API}/company/${companyNumber}/officers`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return (data.items ?? [])
    .filter((officer: Record<string, unknown>) => !officer.resigned_on) // Active officers only
    .map((officer: Record<string, unknown>) => ({
      name: officer.name as string,
      role: officer.officer_role as string,
      appointedOn: officer.appointed_on as string,
      nationality: officer.nationality as string,
      occupation: officer.occupation as string,
    }));
}

// Format address object to string
function formatAddress(address: Record<string, unknown> | null | undefined): string {
  if (!address) return "";

  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
  ].filter(Boolean);

  return parts.join(", ");
}

// LinkedIn enrichment action using Exa.ai
export const enrichWithLinkedIn = action({
  args: {
    founderId: v.id("founders"),
    exaApiKey: v.string(), // Exa.ai API key
    linkedInUrl: v.optional(v.string()),
    searchByName: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get founder details
    const founder = await ctx.runQuery(internal.autoSourcingHelpers.getFounder, {
      founderId: args.founderId,
    });

    if (!founder) {
      throw new Error("Founder not found");
    }

    let profileData: LinkedInProfile | null = null;

    if (args.linkedInUrl) {
      // Enrich from known LinkedIn URL using Exa.ai
      profileData = await fetchLinkedInProfileWithExa(args.exaApiKey, args.linkedInUrl);
    } else if (args.searchByName) {
      // Search for LinkedIn profile by name using Exa.ai
      profileData = await searchLinkedInProfileWithExa(
        args.exaApiKey,
        founder.firstName,
        founder.lastName
      );
    }

    if (profileData) {
      // Update founder with LinkedIn data
      await ctx.runMutation(internal.autoSourcingHelpers.updateFounderWithLinkedIn, {
        founderId: args.founderId,
        linkedInData: profileData,
      });

      return { success: true, profile: profileData };
    }

    return { success: false, message: "Could not find LinkedIn profile" };
  },
});

interface LinkedInProfile {
  linkedInUrl: string;
  headline?: string;
  location?: string;
  profileImageUrl?: string;
  isStealthMode?: boolean; // Detected from profile
  isRecentlyAnnounced?: boolean;
  stealthSignals?: string[]; // What triggered stealth detection
  education: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
    isTopTier?: boolean;
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    isHighGrowth?: boolean;
  }>;
}

// Top-tier universities for scoring
const TOP_TIER_UNIVERSITIES = [
  "oxford", "cambridge", "imperial", "ucl", "lse", "stanford", "mit", "harvard",
  "yale", "princeton", "berkeley", "carnegie mellon", "eth zurich", "caltech",
  "columbia", "chicago", "wharton", "insead", "london business school"
];

// High-growth companies for scoring
const HIGH_GROWTH_COMPANIES = [
  "google", "meta", "facebook", "amazon", "apple", "microsoft", "netflix",
  "stripe", "revolut", "monzo", "wise", "transferwise", "checkout.com",
  "deliveroo", "uber", "airbnb", "spotify", "klarna", "plaid", "figma",
  "notion", "slack", "zoom", "shopify", "coinbase", "openai", "anthropic",
  "deepmind", "palantir", "snowflake", "databricks", "datadog", "twilio",
  "salesforce", "hubspot", "atlassian", "gitlab", "linkedin", "twitter",
  "mckinsey", "bain", "bcg", "goldman sachs", "morgan stanley", "jp morgan"
];

// Stealth mode keywords to detect from LinkedIn
const STEALTH_KEYWORDS = [
  "stealth", "stealth mode", "stealth startup", "building something new",
  "something new", "working on something", "new venture", "unannounced",
  "pre-launch", "under the radar", "confidential", "secret project",
  "founding team", "0 to 1", "zero to one", "building in stealth"
];

// Recently announced keywords
const RECENTLY_ANNOUNCED_KEYWORDS = [
  "just launched", "recently launched", "announcing", "excited to announce",
  "thrilled to share", "proud to announce", "officially launching",
  "coming out of stealth", "out of stealth", "publicly announced"
];

// Fetch LinkedIn profile content using Exa.ai
async function fetchLinkedInProfileWithExa(
  apiKey: string,
  linkedInUrl: string
): Promise<LinkedInProfile | null> {
  try {
    // Use Exa.ai to get contents from the LinkedIn URL
    const response = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [linkedInUrl],
        text: true,
      }),
    });

    if (!response.ok) {
      console.error("Exa.ai error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    const text = result.text || "";

    // Parse the LinkedIn content to extract structured data
    const profile = parseLinkedInContent(linkedInUrl, text);
    return profile;
  } catch (error) {
    console.error("Error fetching LinkedIn profile with Exa:", error);
    return null;
  }
}

// Search for LinkedIn profile by name using Exa.ai
async function searchLinkedInProfileWithExa(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<LinkedInProfile | null> {
  try {
    // Use Exa.ai to search for the person's LinkedIn profile
    const searchQuery = `${firstName} ${lastName} site:linkedin.com/in`;

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 5,
        includeDomains: ["linkedin.com"],
        type: "neural",
        useAutoprompt: true,
        contents: {
          text: true,
        },
      }),
    });

    if (!response.ok) {
      console.error("Exa.ai search error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Find the best match (first result from linkedin.com/in)
    const linkedInResult = data.results.find((r: { url: string }) =>
      r.url.includes("linkedin.com/in/")
    );

    if (!linkedInResult) {
      return null;
    }

    const profile = parseLinkedInContent(linkedInResult.url, linkedInResult.text || "");
    return profile;
  } catch (error) {
    console.error("Error searching LinkedIn with Exa:", error);
    return null;
  }
}

// Parse LinkedIn content text to extract structured data with stealth detection and scoring
function parseLinkedInContent(linkedInUrl: string, text: string): LinkedInProfile {
  const textLower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim());

  // Detect stealth mode signals
  const stealthSignals: string[] = [];
  let isStealthMode = false;
  let isRecentlyAnnounced = false;

  for (const keyword of STEALTH_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      stealthSignals.push(keyword);
      isStealthMode = true;
    }
  }

  for (const keyword of RECENTLY_ANNOUNCED_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      isRecentlyAnnounced = true;
    }
  }

  // Extract headline and location
  let headline = "";
  let location = "";

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.includes("CEO") || line.includes("CTO") || line.includes("Founder") ||
        line.includes("Director") || line.includes("Engineer") || line.includes("Developer") ||
        line.includes("Building") || line.includes("Co-founder")) {
      if (!headline) headline = line;
    }
    if (line.includes("London") || line.includes("UK") || line.includes("United Kingdom") ||
        line.includes("Manchester") || line.includes("Cambridge") || line.includes("Oxford") ||
        line.includes("Edinburgh") || line.includes("Bristol") || line.includes("Birmingham")) {
      if (!location) location = line;
    }
  }

  // Extract and score education
  const education: LinkedInProfile["education"] = [];
  const eduKeywords = ["University", "College", "Institute", "School", "MBA", "BSc", "MSc", "PhD", "Bachelor", "Master"];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of eduKeywords) {
      if (line.includes(keyword)) {
        const isTopTier = TOP_TIER_UNIVERSITIES.some(uni => lineLower.includes(uni));
        education.push({
          school: line.substring(0, 100),
          degree: undefined,
          fieldOfStudy: undefined,
          isTopTier,
        });
        break;
      }
    }
  }

  // Extract and score experience
  const experience: LinkedInProfile["experience"] = [];

  // Look for company mentions
  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Check if this line mentions a high-growth company
    for (const company of HIGH_GROWTH_COMPANIES) {
      if (lineLower.includes(company)) {
        // Try to extract title
        let title = "Unknown";
        const titlePatterns = ["engineer", "developer", "manager", "director", "vp", "head", "lead", "founder", "ceo", "cto", "cfo"];
        for (const pattern of titlePatterns) {
          if (lineLower.includes(pattern)) {
            const idx = lineLower.indexOf(pattern);
            title = line.substring(Math.max(0, idx - 20), idx + pattern.length + 10).trim();
            break;
          }
        }

        experience.push({
          company: company.charAt(0).toUpperCase() + company.slice(1),
          title,
          isHighGrowth: true,
        });
        break;
      }
    }

    // Also look for general company patterns
    const companyPatterns = ["at ", "@ "];
    for (const pattern of companyPatterns) {
      const idx = lineLower.indexOf(pattern);
      if (idx !== -1 && idx < 50) {
        const companyPart = line.substring(idx + pattern.length).trim().split(/[,·\-]/)[0].trim();
        if (companyPart.length > 2 && companyPart.length < 50) {
          const isHighGrowth = HIGH_GROWTH_COMPANIES.some(hg => companyPart.toLowerCase().includes(hg));
          // Avoid duplicates
          if (!experience.some(e => e.company.toLowerCase() === companyPart.toLowerCase())) {
            experience.push({
              company: companyPart,
              title: line.substring(0, idx).trim() || "Unknown",
              isHighGrowth,
            });
          }
        }
        break;
      }
    }
  }

  return {
    linkedInUrl,
    headline: headline || undefined,
    location: location || undefined,
    profileImageUrl: undefined,
    isStealthMode,
    isRecentlyAnnounced,
    stealthSignals: stealthSignals.length > 0 ? stealthSignals : undefined,
    education: education.slice(0, 5),
    experience: experience.slice(0, 10),
  };
}

// Calculate founder score based on education and experience
function calculateFounderScore(profile: LinkedInProfile): {
  educationScore: number;
  experienceScore: number;
  overallScore: number;
} {
  let educationScore = 0;
  let experienceScore = 0;

  // Education scoring (max 100)
  const topTierCount = profile.education.filter(e => e.isTopTier).length;
  if (topTierCount > 0) {
    educationScore = Math.min(100, 50 + topTierCount * 25);
  } else if (profile.education.length > 0) {
    educationScore = 30; // Has some education
  }

  // Experience scoring (max 100)
  const highGrowthCount = profile.experience.filter(e => e.isHighGrowth).length;
  if (highGrowthCount >= 3) {
    experienceScore = 100;
  } else if (highGrowthCount === 2) {
    experienceScore = 80;
  } else if (highGrowthCount === 1) {
    experienceScore = 60;
  } else if (profile.experience.length > 0) {
    experienceScore = 30;
  }

  // Bonus for founder/leadership roles
  const hasLeadershipRole = profile.experience.some(e =>
    e.title.toLowerCase().includes("founder") ||
    e.title.toLowerCase().includes("ceo") ||
    e.title.toLowerCase().includes("cto") ||
    e.title.toLowerCase().includes("head") ||
    e.title.toLowerCase().includes("director")
  );
  if (hasLeadershipRole) {
    experienceScore = Math.min(100, experienceScore + 15);
  }

  // Overall score (weighted average)
  const overallScore = Math.round(educationScore * 0.4 + experienceScore * 0.6);

  return { educationScore, experienceScore, overallScore };
}

// Comprehensive enrichment action - enriches all founders for discovered startups
export const enrichDiscoveredStartups = action({
  args: {
    exaApiKey: v.string(),
    limit: v.optional(v.number()), // How many startups to enrich
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get startups that need enrichment
    const startups = await ctx.runQuery(internal.autoSourcingHelpers.getStartupsNeedingEnrichment, {
      userId: identity.subject,
      limit: args.limit ?? 10,
    });

    const results = {
      startupsProcessed: 0,
      foundersEnriched: 0,
      stealthDetected: 0,
      companiesEnriched: 0,
    };

    for (const startup of startups) {
      try {
        // Get founders for this startup
        const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
          startupId: startup._id,
        });

        let startupStealthFromLinkedIn = false;
        let startupRecentlyAnnounced = false;

        for (const founder of founders) {
          // Search for LinkedIn profile
          const profile = await searchLinkedInProfileWithExa(
            args.exaApiKey,
            founder.firstName,
            founder.lastName
          );

          if (profile) {
            // Calculate scores
            const scores = calculateFounderScore(profile);

            // Update founder with enriched data
            await ctx.runMutation(internal.autoSourcingHelpers.updateFounderEnriched, {
              founderId: founder._id,
              linkedInData: profile,
              scores,
            });

            results.foundersEnriched++;

            // Track stealth signals from any founder
            if (profile.isStealthMode) {
              startupStealthFromLinkedIn = true;
              results.stealthDetected++;
            }
            if (profile.isRecentlyAnnounced) {
              startupRecentlyAnnounced = true;
            }
          }
        }

        // Search for company information via Exa
        const companyInfo = await searchCompanyInfo(args.exaApiKey, startup.companyName);

        // Update startup with enriched data
        await ctx.runMutation(internal.autoSourcingHelpers.updateStartupEnriched, {
          startupId: startup._id,
          isStealthFromLinkedIn: startupStealthFromLinkedIn,
          isRecentlyAnnounced: startupRecentlyAnnounced,
          companyInfo: companyInfo ?? undefined,
        });

        if (companyInfo) {
          results.companiesEnriched++;
        }

        results.startupsProcessed++;
      } catch (error) {
        console.error(`Error enriching startup ${startup._id}:`, error);
      }
    }

    return results;
  },
});

// Search for company information using Exa.ai
async function searchCompanyInfo(apiKey: string, companyName: string): Promise<{
  description?: string;
  website?: string;
  funding?: string;
  news?: string[];
} | null> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: `${companyName} UK startup company`,
        numResults: 5,
        type: "neural",
        useAutoprompt: true,
        contents: {
          text: true,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Extract useful information from results
    let description = "";
    let website = "";
    const news: string[] = [];

    for (const result of data.results) {
      const url = result.url || "";
      const text = result.text || "";

      // Look for company website
      if (!website && !url.includes("linkedin") && !url.includes("twitter") &&
          !url.includes("crunchbase") && !url.includes("news")) {
        website = url;
      }

      // Extract description from first substantial text
      if (!description && text.length > 50) {
        description = text.substring(0, 300);
      }

      // Collect news mentions
      if (url.includes("techcrunch") || url.includes("sifted") || url.includes("news") ||
          url.includes("bloomberg") || url.includes("reuters")) {
        news.push(result.title || url);
      }
    }

    return {
      description: description || undefined,
      website: website || undefined,
      news: news.length > 0 ? news.slice(0, 3) : undefined,
    };
  } catch (error) {
    console.error("Error searching company info:", error);
    return null;
  }
}
