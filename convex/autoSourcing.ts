"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_USER_ID } from "./authHelpers";

// Comprehensive SIC code categories for different startup verticals
const SIC_CODE_CATEGORIES = {
  // Software & SaaS
  "SaaS & Software": {
    codes: ["62011", "62012", "62020", "62030", "62090"],
    description: "Software development, SaaS, cloud applications",
    scalabilityScore: 90,
  },
  // AI & Machine Learning
  "AI & Machine Learning": {
    codes: ["62011", "62012", "72190", "72200"],
    description: "Artificial intelligence, ML, data science",
    scalabilityScore: 95,
  },
  // Data & Cloud Infrastructure
  "Data & Cloud": {
    codes: ["63110", "63120", "63910", "63990"],
    description: "Data processing, hosting, cloud infrastructure",
    scalabilityScore: 85,
  },
  // Fintech
  "Fintech": {
    codes: ["64209", "64303", "64921", "64999", "66110", "66190", "66300"],
    description: "Financial technology, payments, banking",
    scalabilityScore: 90,
  },
  // E-commerce & Marketplaces
  "E-commerce & Marketplaces": {
    codes: ["47910", "47990", "63120"],
    description: "Online retail, marketplaces, D2C brands",
    scalabilityScore: 75,
  },
  // HealthTech & BioTech
  "HealthTech & BioTech": {
    codes: ["72110", "72190", "86210", "86220", "86230"],
    description: "Healthcare technology, biotech, medical devices",
    scalabilityScore: 80,
  },
  // Consumer Tech
  "Consumer Tech": {
    codes: ["62011", "62012", "63120", "59111", "59120"],
    description: "Consumer apps, entertainment, media tech",
    scalabilityScore: 70,
  },
  // FitnessTech & Wellness
  "FitnessTech & Wellness": {
    codes: ["93130", "93110", "96040", "86900"],
    description: "Fitness apps, wellness platforms, health tracking",
    scalabilityScore: 70,
  },
  // FashionTech & Retail Tech
  "FashionTech & Retail": {
    codes: ["14110", "14120", "14130", "46420", "47710"],
    description: "Fashion technology, retail innovation, D2C fashion",
    scalabilityScore: 65,
  },
  // FoodTech & AgriTech
  "FoodTech & AgriTech": {
    codes: ["10110", "10200", "10310", "01110", "01500"],
    description: "Food delivery, agritech, food innovation",
    scalabilityScore: 70,
  },
  // PropTech & Real Estate
  "PropTech": {
    codes: ["68100", "68201", "68202", "68209", "68310"],
    description: "Property technology, real estate platforms",
    scalabilityScore: 75,
  },
  // EdTech
  "EdTech": {
    codes: ["85421", "85422", "85590", "85600"],
    description: "Education technology, online learning",
    scalabilityScore: 80,
  },
  // CleanTech & Sustainability
  "CleanTech & Sustainability": {
    codes: ["35110", "35120", "38110", "38320", "39000"],
    description: "Clean energy, sustainability, environmental tech",
    scalabilityScore: 85,
  },
  // Logistics & Supply Chain
  "Logistics & Supply Chain": {
    codes: ["49410", "52100", "52210", "52290"],
    description: "Logistics tech, supply chain, delivery",
    scalabilityScore: 75,
  },
  // HR Tech & Future of Work
  "HR Tech & Future of Work": {
    codes: ["78100", "78200", "78300", "82990"],
    description: "HR technology, recruitment, workforce management",
    scalabilityScore: 80,
  },
  // Cybersecurity
  "Cybersecurity": {
    codes: ["62020", "62090", "63110"],
    description: "Security software, data protection",
    scalabilityScore: 90,
  },
  // Gaming & Entertainment
  "Gaming & Entertainment": {
    codes: ["58210", "59111", "59120", "62011"],
    description: "Gaming, entertainment tech, streaming",
    scalabilityScore: 75,
  },
  // InsurTech
  "InsurTech": {
    codes: ["65110", "65120", "65201", "65202"],
    description: "Insurance technology, insurtech platforms",
    scalabilityScore: 85,
  },
  // LegalTech
  "LegalTech": {
    codes: ["69101", "69102", "69109"],
    description: "Legal technology, contract automation",
    scalabilityScore: 80,
  },
};

// Business model indicators
const BUSINESS_MODEL_INDICATORS = {
  B2B: {
    keywords: ["enterprise", "business", "b2b", "saas", "platform", "api", "infrastructure", "workflow", "automation"],
    sicPatterns: ["62", "63", "70", "78"], // Software, data, consulting, HR
  },
  B2C: {
    keywords: ["consumer", "app", "users", "subscription", "marketplace", "retail", "shopping"],
    sicPatterns: ["47", "56", "59", "93"], // Retail, food service, entertainment, sports
  },
  DTC: {
    keywords: ["direct", "brand", "d2c", "dtc", "ecommerce", "shop", "store"],
    sicPatterns: ["14", "10", "47"], // Fashion, food, retail
  },
  Marketplace: {
    keywords: ["marketplace", "platform", "connect", "matching", "network"],
    sicPatterns: ["63", "47"],
  },
};

// Scalability signals to look for
const SCALABILITY_SIGNALS = {
  positive: [
    "technology", "platform", "software", "digital", "online", "app", "ai", "automation",
    "saas", "cloud", "api", "data", "machine learning", "marketplace", "subscription"
  ],
  negative: [
    "consulting", "agency", "services", "local", "traditional", "manual", "brick and mortar"
  ],
};

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

// Test API key with basic search (not advanced search)
export const testApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    basicSearchWorks: boolean;
    advancedSearchWorks: boolean;
  }> => {
    const cleanApiKey = args.apiKey.trim();
    const base64Auth = Buffer.from(`${cleanApiKey}:`).toString("base64");

    // Test 1: Try basic company search (this should work with any REST API key)
    let basicSearchWorks = false;
    try {
      const basicUrl = `${COMPANIES_HOUSE_API}/search/companies?q=test&items_per_page=1`;
      const basicResponse = await fetch(basicUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${base64Auth}`,
          "Accept": "application/json",
        },
      });

      if (basicResponse.ok) {
        basicSearchWorks = true;
        console.log("Basic search API works!");
      } else {
        const errorText = await basicResponse.text().catch(() => "");
        console.error(`Basic search failed: ${basicResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("Basic search error:", error);
    }

    // Test 2: Try advanced search
    let advancedSearchWorks = false;
    try {
      const advancedUrl = `${COMPANIES_HOUSE_API}/advanced-search/companies?company_status=active&size=1`;
      const advancedResponse = await fetch(advancedUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${base64Auth}`,
          "Accept": "application/json",
        },
      });

      if (advancedResponse.ok) {
        advancedSearchWorks = true;
        console.log("Advanced search API works!");
      } else {
        const errorText = await advancedResponse.text().catch(() => "");
        console.error(`Advanced search failed: ${advancedResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("Advanced search error:", error);
    }

    return {
      success: basicSearchWorks || advancedSearchWorks,
      message: basicSearchWorks
        ? advancedSearchWorks
          ? "Both basic and advanced search work!"
          : "Basic search works, but advanced search requires additional access. Using fallback."
        : "API key authentication failed. Please check your API key.",
      basicSearchWorks,
      advancedSearchWorks,
    };
  },
});

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
    const userId = identity?.subject ?? DEFAULT_USER_ID;

    const daysBack = args.daysBack ?? 30;
    // Get all SIC codes from all categories if none specified
    const allSicCodes = Object.values(SIC_CODE_CATEGORIES).flatMap(cat => cat.codes);
    const sicCodes = args.sicCodeFilter ?? allSicCodes;

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

    // Process up to 200 companies per run (increased from 50)
    const maxToProcess = 200;
    for (const company of filteredCompanies.slice(0, maxToProcess)) {
      try {
        // Get officers (founders/directors)
        const officers = await getCompanyOfficers(args.apiKey, company.companyNumber);

        // Save to database
        await ctx.runMutation(internal.autoSourcingHelpers.saveDiscoveredStartup, {
          userId,
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
  // Clean the API key (remove any whitespace)
  const cleanApiKey = apiKey.trim();
  const base64Auth = Buffer.from(`${cleanApiKey}:`).toString("base64");

  // First try advanced search
  const advancedResult = await tryAdvancedSearch(base64Auth, fromDate, toDate, sicCode);
  if (advancedResult !== null) {
    return advancedResult;
  }

  // Fallback to basic search if advanced search is not available
  console.log("Advanced search not available, using basic search fallback...");
  return await tryBasicSearchFallback(base64Auth, sicCode, fromDate, toDate);
}

// Try advanced search (requires premium API access)
async function tryAdvancedSearch(
  base64Auth: string,
  fromDate: string,
  toDate: string,
  sicCode: string
): Promise<CompanySearchResult[] | null> {
  const params = new URLSearchParams({
    incorporated_from: fromDate,
    incorporated_to: toDate,
    sic_codes: sicCode,
    size: "100",
    company_status: "active",
  });

  const url = `${COMPANIES_HOUSE_API}/advanced-search/companies?${params.toString()}`;
  console.log(`Trying advanced search: SIC ${sicCode}, ${fromDate} to ${toDate}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${base64Auth}`,
        "Accept": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const items = data.items ?? [];
      console.log(`Advanced search found ${items.length} companies`);

      return items.map((item: Record<string, unknown>) => ({
        companyNumber: item.company_number as string,
        companyName: item.company_name as string,
        companyStatus: item.company_status as string,
        companyType: item.company_type as string,
        incorporationDate: item.date_of_creation as string,
        registeredAddress: formatAddress(item.registered_office_address as Record<string, unknown>),
        sicCodes: item.sic_codes as string[],
      }));
    }

    // If 400/401/403, advanced search is not available
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const errorText = await response.text().catch(() => "");
      console.log(`Advanced search not available (${response.status}): ${errorText}`);
      return null; // Signal to use fallback
    }

    // For 404/416, no results found
    if (response.status === 404 || response.status === 416) {
      return [];
    }

    console.error(`Advanced search unexpected error: ${response.status}`);
    return null;
  } catch (error) {
    console.error("Advanced search error:", error);
    return null;
  }
}

// Fallback: Use basic search API and get company profiles
async function tryBasicSearchFallback(
  base64Auth: string,
  sicCode: string,
  fromDate: string,
  toDate: string
): Promise<CompanySearchResult[]> {
  // Map SIC code to search terms
  const sicToSearch: Record<string, string[]> = {
    "62011": ["software", "tech startup", "saas"],
    "62012": ["business software", "enterprise software"],
    "62020": ["IT consulting", "technology consulting"],
    "62030": ["computer facilities", "hosting"],
    "62090": ["IT services", "technology services"],
    "63110": ["data processing", "data center"],
    "63120": ["web portal", "online platform"],
    "64209": ["fintech", "financial technology"],
    "72190": ["research", "R&D", "science"],
    "72200": ["research development", "innovation"],
  };

  const searchTerms = sicToSearch[sicCode] ?? ["technology startup UK"];
  const companies: CompanySearchResult[] = [];
  const fromDateObj = new Date(fromDate);
  const toDateObj = new Date(toDate);

  for (const term of searchTerms.slice(0, 1)) { // Limit to 1 search per SIC code to avoid rate limits
    try {
      const url = `${COMPANIES_HOUSE_API}/search/companies?q=${encodeURIComponent(term)}&items_per_page=50`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${base64Auth}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`Basic search failed for "${term}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const items = data.items ?? [];

      // Filter by incorporation date
      for (const item of items) {
        const incDate = item.date_of_creation ? new Date(item.date_of_creation) : null;
        if (incDate && incDate >= fromDateObj && incDate <= toDateObj) {
          // Get full company profile to get SIC codes
          const profile = await getCompanyProfile(base64Auth, item.company_number);
          if (profile && profile.sicCodes?.includes(sicCode)) {
            companies.push(profile);
          }
        }
      }
    } catch (error) {
      console.error(`Basic search error for "${term}":`, error);
    }
  }

  console.log(`Basic search fallback found ${companies.length} companies for SIC ${sicCode}`);
  return companies;
}

// Get company profile for detailed info including SIC codes
async function getCompanyProfile(
  base64Auth: string,
  companyNumber: string
): Promise<CompanySearchResult | null> {
  try {
    const url = `${COMPANIES_HOUSE_API}/company/${companyNumber}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${base64Auth}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      companyNumber: data.company_number,
      companyName: data.company_name,
      companyStatus: data.company_status,
      companyType: data.type,
      incorporationDate: data.date_of_creation,
      registeredAddress: formatAddress(data.registered_office_address),
      sicCodes: data.sic_codes,
    };
  } catch {
    return null;
  }
}

// Get company officers
async function getCompanyOfficers(
  apiKey: string,
  companyNumber: string
): Promise<Officer[]> {
  const cleanApiKey = apiKey.trim();
  const url = `${COMPANIES_HOUSE_API}/company/${companyNumber}/officers`;
  const base64Auth = Buffer.from(`${cleanApiKey}:`).toString("base64");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${base64Auth}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Failed to get officers for ${companyNumber}: ${response.status}`);
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
    const userId = identity?.subject ?? DEFAULT_USER_ID;

    // Get startups that need enrichment
    const startups = await ctx.runQuery(internal.autoSourcingHelpers.getStartupsNeedingEnrichment, {
      userId,
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
