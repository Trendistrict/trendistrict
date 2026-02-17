"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_USER_ID } from "./authHelpers";

// Small delay between API calls to avoid rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

    for (const company of filteredCompanies.slice(0, 50)) { // Limit to 50 per run
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

// Exit signal keywords (acquisition, IPO, etc.)
const EXIT_KEYWORDS = [
  "acquired by", "acquisition", "acquired", "exit", "exited",
  "ipo", "went public", "publicly listed", "sold to", "merged with",
  "successful exit", "series", "raised"
];

// Technical role/background indicators
const TECHNICAL_TITLES = [
  "engineer", "developer", "architect", "programmer", "scientist",
  "researcher", "technical", "tech lead", "machine learning", "data",
  "devops", "sre", "infrastructure", "backend", "frontend", "fullstack",
  "full-stack", "software", "hardware", "systems", "security"
];

const TECHNICAL_DEGREES = [
  "computer science", "computing", "software engineering", "electrical engineering",
  "mathematics", "physics", "machine learning", "artificial intelligence",
  "data science", "information technology", "cybersecurity", "robotics",
  "mechanical engineering", "chemical engineering", "bioengineering",
  "engineering", "cs", "meng", "beng"
];

// Domain expertise detection from experience context
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fintech: ["fintech", "payment", "banking", "finance", "trading", "lending", "insurance", "crypto", "blockchain", "defi"],
  ai: ["artificial intelligence", "machine learning", "deep learning", "nlp", "computer vision", "ai", "neural", "llm", "generative"],
  saas: ["saas", "b2b", "enterprise software", "platform", "subscription", "cloud software"],
  healthtech: ["health", "medical", "clinical", "biotech", "pharma", "patient", "healthcare", "nhs", "genomics"],
  edtech: ["education", "learning", "edtech", "teaching", "school", "university", "training", "curriculum"],
  ecommerce: ["ecommerce", "e-commerce", "retail", "marketplace", "shopping", "commerce", "dtc", "d2c"],
  cybersecurity: ["security", "cybersecurity", "infosec", "encryption", "threat", "vulnerability", "penetration"],
  proptech: ["property", "real estate", "proptech", "housing", "construction", "buildings"],
  cleantech: ["clean energy", "sustainability", "renewable", "solar", "climate", "carbon", "green", "environmental"],
  logistics: ["logistics", "supply chain", "shipping", "delivery", "warehouse", "fulfilment", "fleet"],
  gaming: ["gaming", "game", "esports", "entertainment", "streaming", "interactive"],
  hrtech: ["hr", "recruitment", "hiring", "talent", "workforce", "people", "employee"],
};

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

  // Extract and score education with degree detection
  const education: LinkedInProfile["education"] = [];
  const eduKeywords = ["University", "College", "Institute", "School", "MBA", "BSc", "MSc", "PhD", "Bachelor", "Master"];
  let hasPhd = false;
  let hasMba = false;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    for (const keyword of eduKeywords) {
      if (line.includes(keyword)) {
        const isTopTier = TOP_TIER_UNIVERSITIES.some(uni => lineLower.includes(uni));

        // Extract degree type
        let degree: string | undefined;
        if (lineLower.includes("phd") || lineLower.includes("doctorate") || lineLower.includes("dphil")) {
          degree = "PhD";
          hasPhd = true;
        } else if (lineLower.includes("mba")) {
          degree = "MBA";
          hasMba = true;
        } else if (lineLower.includes("master") || lineLower.includes("msc") || lineLower.includes("meng") || lineLower.includes("ma ")) {
          degree = "Masters";
        } else if (lineLower.includes("bachelor") || lineLower.includes("bsc") || lineLower.includes("beng") || lineLower.includes("ba ")) {
          degree = "Bachelors";
        }

        // Extract field of study
        let fieldOfStudy: string | undefined;
        for (const techDegree of TECHNICAL_DEGREES) {
          if (lineLower.includes(techDegree)) {
            fieldOfStudy = techDegree.charAt(0).toUpperCase() + techDegree.slice(1);
            break;
          }
        }

        education.push({
          school: line.substring(0, 100),
          degree,
          fieldOfStudy,
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
        const titlePatterns = ["engineer", "developer", "manager", "director", "vp", "head", "lead", "founder", "ceo", "cto", "cfo", "co-founder", "cofounder", "principal", "partner"];
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

  // --- New enrichment signals ---

  // Repeat founder detection: look for "Founder" / "Co-founder" titles at previous companies
  const founderTitles = experience.filter(e =>
    /\b(founder|co-founder|cofounder)\b/i.test(e.title)
  );
  // If they have founder titles at more than one company, or the current startup plus a previous one
  const isRepeatFounder = founderTitles.length >= 2;

  // Technical founder detection: technical degree or technical title history
  const hasTechnicalDegree = education.some(e =>
    e.fieldOfStudy && TECHNICAL_DEGREES.some(td =>
      e.fieldOfStudy!.toLowerCase().includes(td)
    )
  );
  const hasTechnicalRole = experience.some(e =>
    TECHNICAL_TITLES.some(tt => e.title.toLowerCase().includes(tt))
  );
  const isTechnicalFounder = hasTechnicalDegree || hasTechnicalRole;

  // Previous exits detection
  let previousExits = 0;
  for (const keyword of EXIT_KEYWORDS) {
    if (textLower.includes(keyword)) {
      previousExits++;
    }
  }
  // Normalize — multiple keyword hits for the same exit, cap at reasonable count
  previousExits = Math.min(previousExits, 5);
  // Only count if they were actually a founder/leader (otherwise it's just a company they worked at)
  if (founderTitles.length === 0 && previousExits > 0) {
    // Reduce confidence — they may have been at a company that exited but didn't lead it
    previousExits = Math.min(previousExits, 1);
  }

  // Years of experience estimation
  let yearsOfExperience: number | undefined;
  const currentYear = new Date().getFullYear();
  // Try to extract years from experience entries
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches) {
    const years = yearMatches.map(Number).filter(y => y >= 1980 && y <= currentYear);
    if (years.length >= 2) {
      yearsOfExperience = currentYear - Math.min(...years);
    }
  }

  // Domain expertise detection from full profile text
  const domainExpertise: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchCount = keywords.filter(kw => textLower.includes(kw)).length;
    // Require at least 2 keyword matches to tag a domain (avoids false positives)
    if (matchCount >= 2) {
      domainExpertise.push(domain);
    }
  }

  // Enrichment confidence based on how much data we found
  let enrichmentConfidence: "high" | "medium" | "low" = "low";
  const dataPoints = [
    headline ? 1 : 0,
    location ? 1 : 0,
    education.length > 0 ? 1 : 0,
    experience.length > 0 ? 1 : 0,
    experience.length >= 3 ? 1 : 0,
    education.some(e => e.degree) ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  if (dataPoints >= 5) enrichmentConfidence = "high";
  else if (dataPoints >= 3) enrichmentConfidence = "medium";

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
    // New signals
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

// Calculate founder score based on education, experience, and enrichment signals
function calculateFounderScore(profile: LinkedInProfile): {
  educationScore: number;
  experienceScore: number;
  overallScore: number;
  founderTier: "exceptional" | "strong" | "promising" | "standard";
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

  // PhD bonus (+15) and MBA bonus (+10)
  if (profile.hasPhd) {
    educationScore = Math.min(100, educationScore + 15);
  }
  if (profile.hasMba) {
    educationScore = Math.min(100, educationScore + 10);
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

  // Repeat founder bonus (+15) — proven they can build companies
  if (profile.isRepeatFounder) {
    experienceScore = Math.min(100, experienceScore + 15);
  }

  // Previous exit bonus (+10) — they've done it before successfully
  if (profile.previousExits && profile.previousExits > 0) {
    experienceScore = Math.min(100, experienceScore + 10);
  }

  // Career depth bonus — experienced operators score higher
  if (profile.yearsOfExperience && profile.yearsOfExperience >= 10) {
    experienceScore = Math.min(100, experienceScore + 5);
  }

  // Overall score (weighted average)
  const overallScore = Math.round(educationScore * 0.4 + experienceScore * 0.6);

  // Determine founder tier based on overall score + key signals
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

// Comprehensive enrichment action - enriches all founders for discovered startups
export const enrichDiscoveredStartups = action({
  args: {
    exaApiKey: v.string(),
    crunchbaseApiKey: v.optional(v.string()), // Optional Crunchbase key for funding data
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
        const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
          startupId: startup._id,
        });

        let startupStealthFromLinkedIn = false;
        let startupRecentlyAnnounced = false;

        for (const founder of founders) {
          try {
            // LinkedIn enrichment with rate limiting
            await delay(500);
            const profile = await searchLinkedInProfileWithExa(
              args.exaApiKey,
              founder.firstName,
              founder.lastName
            );

            if (profile) {
              const scores = calculateFounderScore(profile);
              await ctx.runMutation(internal.autoSourcingHelpers.updateFounderEnriched, {
                founderId: founder._id,
                linkedInData: profile,
                scores,
              });
              results.foundersEnriched++;
              if (profile.isStealthMode) {
                startupStealthFromLinkedIn = true;
                results.stealthDetected++;
              }
              if (profile.isRecentlyAnnounced) {
                startupRecentlyAnnounced = true;
              }
            }

            // GitHub enrichment
            await delay(500);
            const githubData = await searchGitHubProfile(
              args.exaApiKey,
              founder.firstName,
              founder.lastName
            );
            if (githubData) {
              await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
                founderId: founder._id,
                githubUrl: githubData.url,
                githubUsername: githubData.username,
                githubRepos: githubData.repos,
                githubBio: githubData.bio,
              });
            }

            // Twitter enrichment
            await delay(500);
            const twitterData = await searchTwitterProfile(
              args.exaApiKey,
              founder.firstName,
              founder.lastName
            );
            if (twitterData) {
              await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
                founderId: founder._id,
                twitterUrl: twitterData.url,
                twitterHandle: twitterData.handle,
                twitterBio: twitterData.bio,
              });
            }
          } catch (error) {
            console.error(`Error enriching founder ${founder.firstName} ${founder.lastName}:`, error);
          }
        }

        // Deep company enrichment (3 parallel Exa calls internally)
        await delay(500);
        const companyInfo = await enrichCompanyDeep(args.exaApiKey, startup.companyName);

        // Crunchbase enrichment (if API key provided)
        if (args.crunchbaseApiKey) {
          try {
            await delay(300);
            const crunchbaseData = await enrichFromCrunchbase(args.crunchbaseApiKey, startup.companyName);
            if (crunchbaseData) {
              await ctx.runMutation(internal.autoSourcingHelpers.updateStartupCrunchbase, {
                startupId: startup._id,
                crunchbaseData,
              });
            }
          } catch (error) {
            console.error(`Crunchbase error for ${startup.companyName}:`, error);
          }
        }

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
        console.log(`Enriched startup ${startup.companyName} (${results.startupsProcessed}/${startups.length})`);
      } catch (error) {
        console.error(`Error enriching startup ${startup._id}:`, error);
      }
    }

    return results;
  },
});

// Re-enrich ALL existing founders and startups (regardless of stage)
// Processes in small batches to avoid Convex action timeout (~2 min)
export const reEnrichAllFounders = action({
  args: {
    exaApiKey: v.string(),
    crunchbaseApiKey: v.optional(v.string()),
    limit: v.optional(v.number()),
    forceAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? DEFAULT_USER_ID;
    // Process max 5 startups per action call to stay within timeout
    const batchSize = Math.min(args.limit ?? 5, 5);

    const startups = await ctx.runQuery(internal.autoSourcingHelpers.getAllStartupsForReenrichment, {
      userId,
      limit: batchSize,
    });

    const results = {
      startupsProcessed: 0,
      foundersEnriched: 0,
      githubFound: 0,
      twitterFound: 0,
      companiesEnriched: 0,
      errors: [] as string[],
    };

    for (const startup of startups) {
      try {
        const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
          startupId: startup._id,
        });

        let startupStealthFromLinkedIn = false;
        let startupRecentlyAnnounced = false;

        for (const founder of founders) {
          if (!args.forceAll && founder.linkedInUrl && founder.founderTier && founder.githubUrl) {
            continue;
          }

          try {
            // LinkedIn enrichment
            if (!founder.linkedInUrl || !founder.founderTier || args.forceAll) {
              await delay(500); // Rate limit protection
              const profile = await searchLinkedInProfileWithExa(
                args.exaApiKey,
                founder.firstName,
                founder.lastName
              );

              if (profile) {
                const scores = calculateFounderScore(profile);
                await ctx.runMutation(internal.autoSourcingHelpers.updateFounderEnriched, {
                  founderId: founder._id,
                  linkedInData: profile,
                  scores,
                });
                results.foundersEnriched++;
                if (profile.isStealthMode) startupStealthFromLinkedIn = true;
                if (profile.isRecentlyAnnounced) startupRecentlyAnnounced = true;
              }
            }

            // GitHub enrichment
            if (!founder.githubUrl) {
              await delay(500);
              const githubData = await searchGitHubProfile(
                args.exaApiKey,
                founder.firstName,
                founder.lastName
              );
              if (githubData) {
                await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
                  founderId: founder._id,
                  githubUrl: githubData.url,
                  githubUsername: githubData.username,
                  githubRepos: githubData.repos,
                  githubBio: githubData.bio,
                });
                results.githubFound++;
              }
            }

            // Twitter enrichment
            if (!founder.twitterUrl) {
              await delay(500);
              const twitterData = await searchTwitterProfile(
                args.exaApiKey,
                founder.firstName,
                founder.lastName
              );
              if (twitterData) {
                await ctx.runMutation(internal.autoSourcingHelpers.updateFounderSocialProfiles, {
                  founderId: founder._id,
                  twitterUrl: twitterData.url,
                  twitterHandle: twitterData.handle,
                  twitterBio: twitterData.bio,
                });
                results.twitterFound++;
              }
            }
          } catch (error) {
            const msg = `Founder ${founder.firstName} ${founder.lastName}: ${error instanceof Error ? error.message : "unknown error"}`;
            results.errors.push(msg);
            console.error(msg);
          }
        }

        // Deep company enrichment (3 parallel Exa calls internally)
        await delay(500);
        const companyInfo = await enrichCompanyDeep(args.exaApiKey, startup.companyName);

        if (args.crunchbaseApiKey) {
          try {
            await delay(300);
            const crunchbaseData = await enrichFromCrunchbase(args.crunchbaseApiKey, startup.companyName);
            if (crunchbaseData) {
              await ctx.runMutation(internal.autoSourcingHelpers.updateStartupCrunchbase, {
                startupId: startup._id,
                crunchbaseData,
              });
            }
          } catch (error) {
            console.error(`Crunchbase error for ${startup.companyName}:`, error);
          }
        }

        // Update startup — preserve current pipeline stage
        await ctx.runMutation(internal.autoSourcingHelpers.updateStartupEnrichedPreserveStage, {
          startupId: startup._id,
          isStealthFromLinkedIn: startupStealthFromLinkedIn,
          isRecentlyAnnounced: startupRecentlyAnnounced,
          companyInfo: companyInfo ?? undefined,
        });

        if (companyInfo) results.companiesEnriched++;
        results.startupsProcessed++;

        console.log(`Re-enriched startup ${startup.companyName} (${results.startupsProcessed}/${startups.length})`);
      } catch (error) {
        const msg = `Startup ${startup.companyName}: ${error instanceof Error ? error.message : "unknown error"}`;
        results.errors.push(msg);
        console.error(msg);
      }
    }

    return results;
  },
});

// ============ GITHUB PROFILE DISCOVERY ============

async function searchGitHubProfile(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<{ url: string; username: string; repos?: number; bio?: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
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
    // Match github.com/{username} (not repo pages)
    const profileResult = data.results?.find((r: { url: string }) => {
      const url = r.url;
      // Match https://github.com/username (1 path segment, not a repo)
      const match = url.match(/github\.com\/([^/]+)\/?$/);
      return match && !["topics", "explore", "trending", "search"].includes(match[1]);
    });

    if (!profileResult) return null;

    const url = profileResult.url;
    const username = url.match(/github\.com\/([^/]+)/)?.[1] || "";
    const text = (profileResult.text || "").toLowerCase();

    // Try to extract repo count from profile text
    let repos: number | undefined;
    const repoMatch = text.match(/(\d+)\s*repositor/i);
    if (repoMatch) repos = parseInt(repoMatch[1]);

    // Extract bio (first meaningful line)
    const lines = (profileResult.text || "").split("\n").filter((l: string) => l.trim());
    let bio: string | undefined;
    for (const line of lines.slice(0, 5)) {
      if (line.length > 20 && line.length < 200 && !line.includes("github.com")) {
        bio = line.trim();
        break;
      }
    }

    return { url, username, repos, bio };
  } catch (error) {
    console.error("Error searching GitHub profile:", error);
    return null;
  }
}

// ============ TWITTER/X PROFILE DISCOVERY ============

async function searchTwitterProfile(
  apiKey: string,
  firstName: string,
  lastName: string
): Promise<{ url: string; handle: string; bio?: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
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
    const profileResult = data.results?.find((r: { url: string }) => {
      const url = r.url;
      // Match twitter.com/{handle} or x.com/{handle}
      return /(?:twitter\.com|x\.com)\/[^/]+\/?$/.test(url) &&
        !url.includes("/status/") && !url.includes("/search");
    });

    if (!profileResult) return null;

    const url = profileResult.url;
    const handle = url.match(/(?:twitter\.com|x\.com)\/([^/]+)/)?.[1] || "";

    // Extract bio from profile text
    const lines = (profileResult.text || "").split("\n").filter((l: string) => l.trim());
    let bio: string | undefined;
    for (const line of lines.slice(0, 5)) {
      if (line.length > 15 && line.length < 200 && !line.includes("twitter.com") && !line.includes("x.com")) {
        bio = line.trim();
        break;
      }
    }

    return { url, handle, bio };
  } catch (error) {
    console.error("Error searching Twitter profile:", error);
    return null;
  }
}

// ============ DEEP COMPANY ENRICHMENT ============

interface CompanyEnrichmentResult {
  description?: string;
  website?: string;
  productDescription?: string;
  businessModel?: string;
  techStack?: string[];
  teamSize?: string;
  newsArticles?: Array<{ title: string; url: string; source?: string; date?: string }>;
  fundingDetails?: Array<{ round?: string; amount?: string; date?: string; investors?: string[] }>;
  crunchbaseUrl?: string;
}

// Tech stack keywords to detect from website/company content
const TECH_STACK_KEYWORDS: Record<string, string> = {
  "react": "React", "next.js": "Next.js", "nextjs": "Next.js",
  "vue": "Vue.js", "angular": "Angular", "svelte": "Svelte",
  "node.js": "Node.js", "nodejs": "Node.js", "python": "Python",
  "django": "Django", "flask": "Flask", "fastapi": "FastAPI",
  "typescript": "TypeScript", "golang": "Go", "rust": "Rust",
  "kubernetes": "Kubernetes", "docker": "Docker", "aws": "AWS",
  "gcp": "Google Cloud", "azure": "Azure", "terraform": "Terraform",
  "graphql": "GraphQL", "postgresql": "PostgreSQL", "mongodb": "MongoDB",
  "redis": "Redis", "elasticsearch": "Elasticsearch", "kafka": "Kafka",
  "openai": "OpenAI", "langchain": "LangChain", "pytorch": "PyTorch",
  "tensorflow": "TensorFlow", "hugging face": "Hugging Face",
};

const NEWS_DOMAINS = [
  "techcrunch.com", "sifted.eu", "bloomberg.com", "reuters.com",
  "theguardian.com", "ft.com", "wired.com", "thenextweb.com",
  "venturebeat.com", "eu-startups.com", "uktech.news", "cityam.com",
  "startups.co.uk", "businessinsider.com", "forbes.com",
];

const FUNDING_PATTERNS = [
  /(?:raised?|secures?|closes?)\s+(?:£|\$|€)(\d+(?:\.\d+)?)\s*(m(?:illion)?|k|bn|billion)?/gi,
  /(?:£|\$|€)(\d+(?:\.\d+)?)\s*(m(?:illion)?|k|bn|billion)?\s+(?:seed|series\s*[a-d]|pre-seed|round|funding|investment)/gi,
  /(seed|series\s*[a-d]|pre-seed)\s+(?:round|funding)?\s*(?:of\s+)?(?:£|\$|€)(\d+(?:\.\d+)?)\s*(m(?:illion)?|k|bn|billion)?/gi,
];

const INVESTOR_PATTERNS = [
  /(?:led by|from|backed by|investors?\s+include)\s+([A-Z][a-zA-Z\s&]+(?:Capital|Ventures|Partners|VC|Fund|Investments|Seed))/gi,
  /([A-Z][a-zA-Z\s&]+(?:Capital|Ventures|Partners|VC|Fund))\s+(?:led|participated|invested|joined)/gi,
];

async function enrichCompanyDeep(
  apiKey: string,
  companyName: string
): Promise<CompanyEnrichmentResult | null> {
  try {
    // Run multiple Exa searches in parallel for different aspects
    const [generalResults, newsResults, fundingResults] = await Promise.all([
      // 1. General company info + website
      exaSearch(apiKey, `${companyName} UK startup company`, 5),
      // 2. News and press mentions
      exaSearch(apiKey, `${companyName} startup news announcement launch`, 5, NEWS_DOMAINS),
      // 3. Funding/investment news
      exaSearch(apiKey, `${companyName} startup funding raised investment round`, 5),
    ]);

    const result: CompanyEnrichmentResult = {};

    // === Process general results ===
    if (generalResults) {
      for (const item of generalResults) {
        const url = item.url || "";
        const text = item.text || "";

        // Find company website (exclude social/news/aggregator sites)
        if (!result.website && url.length > 0 &&
            !url.includes("linkedin") && !url.includes("twitter") && !url.includes("x.com") &&
            !url.includes("crunchbase") && !url.includes("pitchbook") &&
            !url.includes("companieshouse") && !url.includes("endole") &&
            !NEWS_DOMAINS.some(d => url.includes(d))) {
          result.website = url;
        }

        // Extract Crunchbase URL
        if (url.includes("crunchbase.com") && !result.crunchbaseUrl) {
          result.crunchbaseUrl = url;
        }

        // Extract description
        if (!result.description && text.length > 50) {
          result.description = text.substring(0, 500);
        }

        // Detect tech stack from content
        if (text.length > 30) {
          const textLower = text.toLowerCase();
          const detectedTech: string[] = [];
          for (const [keyword, label] of Object.entries(TECH_STACK_KEYWORDS)) {
            if (textLower.includes(keyword) && !detectedTech.includes(label)) {
              detectedTech.push(label);
            }
          }
          if (detectedTech.length > 0) {
            result.techStack = [...new Set([...(result.techStack || []), ...detectedTech])];
          }
        }

        // Detect business model
        if (!result.businessModel && text.length > 30) {
          const textLower = text.toLowerCase();
          if (textLower.includes("b2b") || textLower.includes("enterprise")) {
            result.businessModel = "B2B";
          } else if (textLower.includes("b2c") || textLower.includes("consumer")) {
            result.businessModel = "B2C";
          } else if (textLower.includes("marketplace")) {
            result.businessModel = "Marketplace";
          } else if (textLower.includes("d2c") || textLower.includes("dtc") || textLower.includes("direct to consumer")) {
            result.businessModel = "DTC";
          } else if (textLower.includes("b2b2c")) {
            result.businessModel = "B2B2C";
          }
        }

        // Detect team size
        if (!result.teamSize && text.length > 30) {
          const sizeMatch = text.match(/(\d+)\s*(?:employees?|team\s*members?|people|staff)/i);
          if (sizeMatch) {
            const count = parseInt(sizeMatch[1]);
            if (count >= 1 && count <= 10000) {
              result.teamSize = count <= 10 ? "1-10" :
                count <= 50 ? "11-50" :
                count <= 200 ? "51-200" :
                count <= 500 ? "201-500" : "500+";
            }
          }
        }
      }
    }

    // === Process news results ===
    const newsArticles: CompanyEnrichmentResult["newsArticles"] = [];
    if (newsResults) {
      for (const item of newsResults) {
        const url = item.url || "";
        const title = item.title || "";
        if (!title && !url) continue;

        // Determine source from URL
        let source: string | undefined;
        for (const domain of NEWS_DOMAINS) {
          if (url.includes(domain)) {
            source = domain.split(".")[0];
            // Capitalize
            source = source.charAt(0).toUpperCase() + source.slice(1);
            break;
          }
        }

        // Extract date if available
        const dateMatch = (item.publishedDate || item.text || "").match(/\d{4}-\d{2}-\d{2}/);

        newsArticles.push({
          title: title.substring(0, 200),
          url,
          source,
          date: dateMatch?.[0],
        });
      }
      if (newsArticles.length > 0) {
        result.newsArticles = newsArticles.slice(0, 5);
      }
    }

    // === Process funding results ===
    const fundingDetails: CompanyEnrichmentResult["fundingDetails"] = [];
    if (fundingResults) {
      for (const item of fundingResults) {
        const text = item.text || "";
        if (text.length < 20) continue;

        // Extract funding amounts
        for (const pattern of FUNDING_PATTERNS) {
          pattern.lastIndex = 0; // Reset regex state
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const funding: { round?: string; amount?: string; date?: string; investors?: string[] } = {};

            // Parse amount
            const amountParts = match.slice(1).filter(Boolean);
            if (amountParts.length >= 1) {
              const numStr = amountParts.find(p => /\d/.test(p));
              const suffix = amountParts.find(p => /^(m|k|bn|million|billion)/i.test(p));
              if (numStr) {
                funding.amount = `£${numStr}${suffix ? suffix.charAt(0).toUpperCase() : "M"}`;
              }
            }

            // Parse round type
            const roundMatch = text.match(/(pre-seed|seed|series\s*[a-d])/i);
            if (roundMatch) {
              funding.round = roundMatch[1].toLowerCase().replace(/\s+/g, "-");
            }

            // Parse date
            const dateMatch = text.match(/\b(20\d{2})\b/);
            if (dateMatch) funding.date = dateMatch[1];

            if (funding.amount || funding.round) {
              fundingDetails.push(funding);
            }
          }
        }

        // Extract investors
        for (const pattern of INVESTOR_PATTERNS) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const investorName = match[1].trim();
            if (investorName.length > 3 && investorName.length < 60) {
              // Attach to most recent funding detail or create new one
              if (fundingDetails.length > 0) {
                const last = fundingDetails[fundingDetails.length - 1];
                last.investors = [...(last.investors || []), investorName];
              } else {
                fundingDetails.push({ investors: [investorName] });
              }
            }
          }
        }
      }

      if (fundingDetails.length > 0) {
        // Deduplicate funding entries
        const seen = new Set<string>();
        result.fundingDetails = fundingDetails.filter(f => {
          const key = `${f.round || ""}-${f.amount || ""}`;
          if (seen.has(key) && key !== "-") return false;
          seen.add(key);
          return true;
        }).slice(0, 5);

        // Update funding stage from most recent round
        // (will be used by updateStartupEnriched)
      }
    }

    // === Extract product description from website ===
    if (result.website) {
      try {
        const websiteContent = await exaFetchUrl(apiKey, result.website);
        if (websiteContent) {
          const text = websiteContent.text || "";
          // Take the first substantial paragraph as product description
          const paragraphs = text.split("\n").filter((p: string) => p.trim().length > 40);
          if (paragraphs.length > 0) {
            result.productDescription = paragraphs[0].trim().substring(0, 500);
          }

          // Also detect tech stack from website
          const textLower = text.toLowerCase();
          for (const [keyword, label] of Object.entries(TECH_STACK_KEYWORDS)) {
            if (textLower.includes(keyword)) {
              result.techStack = [...new Set([...(result.techStack || []), label])];
            }
          }
        }
      } catch (error) {
        console.error("Error fetching website content:", error);
      }
    }

    // Only return if we found something useful
    if (result.description || result.website || result.newsArticles || result.fundingDetails) {
      return result;
    }

    return null;
  } catch (error) {
    console.error("Error in deep company enrichment:", error);
    return null;
  }
}

// Helper: Exa search with optional domain filtering
async function exaSearch(
  apiKey: string,
  query: string,
  numResults: number,
  includeDomains?: string[],
): Promise<Array<{ url: string; text: string; title: string; publishedDate?: string }> | null> {
  try {
    const body: Record<string, unknown> = {
      query,
      numResults,
      type: "neural",
      useAutoprompt: true,
      contents: { text: true },
    };
    if (includeDomains && includeDomains.length > 0) {
      body.includeDomains = includeDomains;
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.results || null;
  } catch {
    return null;
  }
}

// Helper: Fetch a specific URL's content via Exa
async function exaFetchUrl(
  apiKey: string,
  url: string
): Promise<{ text: string } | null> {
  try {
    const response = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        urls: [url],
        text: true,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

// ============ CRUNCHBASE ENRICHMENT ============

export interface CrunchbaseData {
  totalFunding?: string;
  lastRound?: string;
  lastRoundDate?: string;
  investors?: string[];
  employeeCount?: string;
  categories?: string[];
}

export async function enrichFromCrunchbase(
  apiKey: string,
  companyName: string
): Promise<CrunchbaseData | null> {
  try {
    // Search for company on Crunchbase
    const searchUrl = `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations&limit=3`;

    const searchResponse = await fetch(searchUrl, {
      headers: { "X-cb-user-key": apiKey },
    });

    if (!searchResponse.ok) {
      console.error("Crunchbase search error:", searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const org = searchData.entities?.[0];
    if (!org) return null;

    const permalink = org.identifier?.permalink;
    if (!permalink) return null;

    // Get organization details
    const orgUrl = `https://api.crunchbase.com/api/v4/entities/organizations/${permalink}?field_ids=short_description,categories,num_employees_enum,funding_total,last_funding_type,last_funding_at,investor_identifiers&card_ids=funding_rounds`;

    const orgResponse = await fetch(orgUrl, {
      headers: { "X-cb-user-key": apiKey },
    });

    if (!orgResponse.ok) return null;

    const orgData = await orgResponse.json();
    const props = orgData.properties || {};

    const result: CrunchbaseData = {};

    // Total funding
    if (props.funding_total?.value_usd) {
      const amt = props.funding_total.value_usd;
      if (amt >= 1e9) result.totalFunding = `$${(amt / 1e9).toFixed(1)}B`;
      else if (amt >= 1e6) result.totalFunding = `$${(amt / 1e6).toFixed(1)}M`;
      else if (amt >= 1e3) result.totalFunding = `$${(amt / 1e3).toFixed(0)}K`;
      else result.totalFunding = `$${amt}`;
    }

    // Last round
    if (props.last_funding_type) {
      result.lastRound = props.last_funding_type.replace(/_/g, " ");
    }
    if (props.last_funding_at) {
      result.lastRoundDate = props.last_funding_at;
    }

    // Investors
    if (props.investor_identifiers) {
      result.investors = props.investor_identifiers
        .slice(0, 10)
        .map((i: { value: string }) => i.value);
    }

    // Employee count
    if (props.num_employees_enum) {
      result.employeeCount = props.num_employees_enum.replace(/c_/g, "").replace(/_/g, "-");
    }

    // Categories
    if (props.categories) {
      result.categories = props.categories.map((c: { value: string }) => c.value);
    }

    return result;
  } catch (error) {
    console.error("Crunchbase enrichment error:", error);
    return null;
  }
}
