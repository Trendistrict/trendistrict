"use node";

import { action, internalMutation, internalQuery } from "./_generated/server";
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
        await ctx.runMutation(internal.autoSourcing.saveDiscoveredStartup, {
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

// LinkedIn enrichment action (requires external API like Proxycurl or Apollo)
export const enrichWithLinkedIn = action({
  args: {
    founderId: v.id("founders"),
    linkedInApiKey: v.string(), // Proxycurl or Apollo API key
    linkedInUrl: v.optional(v.string()),
    searchByName: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get founder details
    const founder = await ctx.runQuery(internal.autoSourcing.getFounder, {
      founderId: args.founderId,
    });

    if (!founder) {
      throw new Error("Founder not found");
    }

    let profileData: LinkedInProfile | null = null;

    if (args.linkedInUrl) {
      // Enrich from known LinkedIn URL using Proxycurl
      profileData = await fetchLinkedInProfile(args.linkedInApiKey, args.linkedInUrl);
    } else if (args.searchByName) {
      // Search for LinkedIn profile by name
      profileData = await searchLinkedInProfile(
        args.linkedInApiKey,
        founder.firstName,
        founder.lastName
      );
    }

    if (profileData) {
      // Update founder with LinkedIn data
      await ctx.runMutation(internal.autoSourcing.updateFounderWithLinkedIn, {
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

// Fetch LinkedIn profile using Proxycurl API
async function fetchLinkedInProfile(
  apiKey: string,
  linkedInUrl: string
): Promise<LinkedInProfile | null> {
  try {
    const response = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedInUrl)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Proxycurl error:", response.status);
      return null;
    }

    const data = await response.json();

    return {
      linkedInUrl,
      headline: data.headline,
      location: data.city ? `${data.city}, ${data.country_full_name}` : data.country_full_name,
      profileImageUrl: data.profile_pic_url,
      education: (data.education ?? []).map((edu: Record<string, unknown>) => ({
        school: edu.school as string,
        degree: edu.degree_name as string,
        fieldOfStudy: edu.field_of_study as string,
        startYear: edu.starts_at ? (edu.starts_at as { year: number }).year : undefined,
        endYear: edu.ends_at ? (edu.ends_at as { year: number }).year : undefined,
      })),
      experience: (data.experiences ?? []).map((exp: Record<string, unknown>) => ({
        company: exp.company as string,
        title: exp.title as string,
        startDate: exp.starts_at
          ? `${(exp.starts_at as { year: number }).year}-${(exp.starts_at as { month: number }).month}`
          : undefined,
        endDate: exp.ends_at
          ? `${(exp.ends_at as { year: number }).year}-${(exp.ends_at as { month: number }).month}`
          : undefined,
        isCurrent: !exp.ends_at,
      })),
    };
  } catch (error) {
    console.error("Error fetching LinkedIn profile:", error);
    return null;
  }
}

// Search for LinkedIn profile by name
async function searchLinkedInProfile(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<LinkedInProfile | null> {
  try {
    // Using Proxycurl's Person Search API
    const response = await fetch(
      `https://nubela.co/proxycurl/api/search/person?first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&country=UK`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Get the first result's full profile
      const linkedInUrl = data.results[0].linkedin_profile_url;
      return fetchLinkedInProfile(apiKey, linkedInUrl);
    }

    return null;
  } catch (error) {
    console.error("Error searching LinkedIn:", error);
    return null;
  }
}

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

// Get sourcing statistics
export const getSourcingStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const allStartups = await ctx.db
      .query("startups")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const autoSourced = allStartups.filter((s) => s.source === "auto_sourcing");
    const stealthCount = autoSourced.filter((s) => s.isStealthMode).length;
    const recentlyAnnouncedCount = autoSourced.filter((s) => s.recentlyAnnounced).length;

    return {
      totalAutoSourced: autoSourced.length,
      stealthCount,
      recentlyAnnouncedCount,
      lastWeek: autoSourced.filter(
        (s) => s.discoveredAt > Date.now() - 7 * 24 * 60 * 60 * 1000
      ).length,
    };
  },
});
