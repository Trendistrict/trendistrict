"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Companies House API base URL
const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk";

// Search for companies by name
export const searchCompanies = action({
  args: {
    query: v.string(),
    apiKey: v.string(),
    itemsPerPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const itemsPerPage = args.itemsPerPage ?? 20;

    const url = `${COMPANIES_HOUSE_API}/search/companies?q=${encodeURIComponent(args.query)}&items_per_page=${itemsPerPage}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(args.apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Companies House API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      totalResults: data.total_results,
      items: data.items?.map((item: Record<string, unknown>) => ({
        companyNumber: item.company_number,
        companyName: item.title,
        companyStatus: item.company_status,
        companyType: item.company_type,
        incorporationDate: item.date_of_creation,
        registeredAddress: formatAddress(item.address_snippet),
        sicCodes: item.sic_codes,
      })) ?? [],
    };
  },
});

// Get company details by company number
export const getCompanyDetails = action({
  args: {
    companyNumber: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const url = `${COMPANIES_HOUSE_API}/company/${args.companyNumber}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(args.apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Companies House API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      companyNumber: data.company_number,
      companyName: data.company_name,
      companyStatus: data.company_status,
      companyType: data.type,
      incorporationDate: data.date_of_creation,
      registeredAddress: formatRegisteredAddress(data.registered_office_address),
      sicCodes: data.sic_codes,
      accounts: data.accounts,
      confirmationStatement: data.confirmation_statement,
    };
  },
});

// Get company officers (directors)
export const getCompanyOfficers = action({
  args: {
    companyNumber: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const url = `${COMPANIES_HOUSE_API}/company/${args.companyNumber}/officers`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(args.apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Companies House API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data.items?.map((officer: Record<string, unknown>) => ({
      name: officer.name,
      role: officer.officer_role,
      appointedOn: officer.appointed_on,
      resignedOn: officer.resigned_on,
      nationality: officer.nationality,
      occupation: officer.occupation,
      countryOfResidence: officer.country_of_residence,
    })) ?? [];
  },
});

// Search for recently incorporated companies
export const searchRecentIncorporations = action({
  args: {
    apiKey: v.string(),
    incorporatedFrom: v.string(), // YYYY-MM-DD format
    incorporatedTo: v.optional(v.string()),
    sicCodes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Companies House advanced search endpoint
    let url = `${COMPANIES_HOUSE_API}/advanced-search/companies?incorporated_from=${args.incorporatedFrom}`;

    if (args.incorporatedTo) {
      url += `&incorporated_to=${args.incorporatedTo}`;
    }

    if (args.sicCodes && args.sicCodes.length > 0) {
      url += `&sic_codes=${args.sicCodes.join(",")}`;
    }

    url += "&size=100";

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(args.apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Companies House API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      totalResults: data.total_results,
      items: data.items?.map((item: Record<string, unknown>) => ({
        companyNumber: item.company_number,
        companyName: item.company_name,
        companyStatus: item.company_status,
        companyType: item.company_type,
        incorporationDate: item.date_of_creation,
        registeredAddress: formatRegisteredAddress(item.registered_office_address as Record<string, unknown>),
        sicCodes: item.sic_codes,
      })) ?? [],
    };
  },
});

// Get filing history
export const getFilingHistory = action({
  args: {
    companyNumber: v.string(),
    apiKey: v.string(),
    itemsPerPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const itemsPerPage = args.itemsPerPage ?? 25;
    const url = `${COMPANIES_HOUSE_API}/company/${args.companyNumber}/filing-history?items_per_page=${itemsPerPage}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(args.apiKey + ":").toString("base64")}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Companies House API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data.items?.map((filing: Record<string, unknown>) => ({
      category: filing.category,
      description: filing.description,
      date: filing.date,
      type: filing.type,
      barcode: filing.barcode,
    })) ?? [];
  },
});

// Helper function to format address
function formatAddress(address: unknown): string {
  if (typeof address === "string") {
    return address;
  }
  return "";
}

// Helper function to format registered address object
function formatRegisteredAddress(address: Record<string, unknown> | null | undefined): string {
  if (!address) return "";

  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
}

// Tech SIC codes for filtering tech startups
export const TECH_SIC_CODES = [
  "62011", // Computer programming activities
  "62012", // Business and domestic software development
  "62020", // Information technology consultancy activities
  "62030", // Computer facilities management activities
  "62090", // Other information technology service activities
  "63110", // Data processing, hosting and related activities
  "63120", // Web portals
  "63910", // News agency activities
  "63990", // Other information service activities n.e.c.
  "70210", // Public relations and communications activities
  "72110", // Research and experimental development on biotechnology
  "72190", // Other research and experimental development on natural sciences and engineering
];

// Fintech SIC codes
export const FINTECH_SIC_CODES = [
  "64110", // Central banking
  "64191", // Banks
  "64192", // Building societies
  "64201", // Activities of financial holding companies
  "64205", // Activities of financial services holding companies
  "64209", // Activities of other holding companies n.e.c.
  "64301", // Activities of investment trusts
  "64302", // Activities of unit trusts
  "64303", // Activities of venture and development capital companies
  "64304", // Activities of open-ended investment companies
  "64305", // Activities of property unit trusts
  "64306", // Activities of real estate investment trusts
  "64910", // Financial leasing
  "64921", // Credit granting by non-deposit taking finance houses and other specialist consumer credit grantors
  "64922", // Activities of mortgage finance companies
  "64929", // Other credit granting n.e.c.
  "64991", // Security dealing on own account
  "64992", // Factoring
  "64999", // Financial intermediation not elsewhere classified
  "66110", // Administration of financial markets
  "66120", // Security and commodity contracts dealing activities
  "66190", // Activities auxiliary to financial intermediation n.e.c.
  "66210", // Risk and damage evaluation
  "66220", // Activities of insurance agents and brokers
  "66290", // Other activities auxiliary to insurance and pension funding
  "66300", // Fund management activities
];
