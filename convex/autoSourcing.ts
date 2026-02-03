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
  education: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startYear?: number;
    endYear?: number;
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
  }>;
}

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

// Parse LinkedIn content text to extract structured data
function parseLinkedInContent(linkedInUrl: string, text: string): LinkedInProfile {
  // Extract headline (usually first line or after the name)
  const lines = text.split("\n").filter((l) => l.trim());
  let headline = "";
  let location = "";

  // Try to find headline and location from the content
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    // Common patterns for headlines
    if (line.includes("CEO") || line.includes("CTO") || line.includes("Founder") ||
        line.includes("Director") || line.includes("Engineer") || line.includes("Developer")) {
      if (!headline) headline = line;
    }
    // Location patterns
    if (line.includes("London") || line.includes("UK") || line.includes("United Kingdom") ||
        line.includes("Manchester") || line.includes("Cambridge") || line.includes("Oxford")) {
      if (!location) location = line;
    }
  }

  // Extract education entries
  const education: LinkedInProfile["education"] = [];
  const eduKeywords = ["University", "College", "Institute", "School", "MBA", "BSc", "MSc", "PhD", "Bachelor", "Master"];

  for (const line of lines) {
    for (const keyword of eduKeywords) {
      if (line.includes(keyword)) {
        // Try to extract school name
        education.push({
          school: line.substring(0, 100), // Limit length
          degree: undefined,
          fieldOfStudy: undefined,
        });
        break;
      }
    }
  }

  // Extract experience entries
  const experience: LinkedInProfile["experience"] = [];
  const companyPatterns = ["at ", "@ ", "worked at", "working at"];

  for (const line of lines) {
    for (const pattern of companyPatterns) {
      const idx = line.toLowerCase().indexOf(pattern);
      if (idx !== -1) {
        const companyPart = line.substring(idx + pattern.length).trim();
        if (companyPart.length > 2 && companyPart.length < 100) {
          experience.push({
            company: companyPart.split(/[,·\-]/)[0].trim(),
            title: line.substring(0, idx).trim() || "Unknown",
          });
          break;
        }
      }
    }
  }

  return {
    linkedInUrl,
    headline: headline || undefined,
    location: location || undefined,
    profileImageUrl: undefined, // Exa doesn't provide images
    education: education.slice(0, 5), // Limit to 5 education entries
    experience: experience.slice(0, 10), // Limit to 10 experience entries
  };
}
