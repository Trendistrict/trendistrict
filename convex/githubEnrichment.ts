"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { sleep } from "./lib/rateLimiter";

// GitHub API base URL
const GITHUB_API = "https://api.github.com";

// Known technical indicators for founders
const STRONG_TECH_SIGNALS = [
  "machine learning", "ml", "ai", "artificial intelligence",
  "blockchain", "web3", "crypto",
  "startup", "founder", "cto", "engineer", "developer",
  "fullstack", "full-stack", "backend", "frontend",
  "deep learning", "data science", "devops", "sre",
];

// Major tech companies that indicate strong technical background
const MAJOR_TECH_ORGS = [
  "google", "meta", "facebook", "microsoft", "amazon", "apple",
  "stripe", "netflix", "uber", "airbnb", "spotify",
  "deepmind", "openai", "anthropic", "figma", "notion",
  "vercel", "supabase", "planetscale",
];

// High-value programming languages for startups
const HIGH_VALUE_LANGUAGES = [
  "TypeScript", "Python", "Rust", "Go", "Kotlin", "Swift",
  "JavaScript", "Java", "C++", "Scala",
];

interface GitHubUserData {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  avatarUrl: string;
  profileUrl: string;
}

interface GitHubEnrichmentResult {
  found: boolean;
  githubUsername?: string;
  githubUrl?: string;
  publicRepos?: number;
  followers?: number;
  technicalScore?: number;
  primaryLanguages?: string[];
  hasStrongTechSignals?: boolean;
  orgAffiliations?: string[];
  contributionLevel?: "high" | "medium" | "low" | "none";
  error?: string;
}

// Search for a person on GitHub by name
async function searchGitHubUser(
  firstName: string,
  lastName: string,
  location?: string
): Promise<GitHubUserData | null> {
  try {
    // Build search query
    let query = `${firstName} ${lastName} in:name`;
    if (location) {
      query += ` location:${location}`;
    }

    const searchUrl = `${GITHUB_API}/search/users?q=${encodeURIComponent(query)}&per_page=5`;

    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Trendistrict-VC-Platform",
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.log("GitHub API rate limited");
        return null;
      }
      console.log(`GitHub search failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Get the first result and fetch full profile
    const user = data.items[0];
    const userUrl = `${GITHUB_API}/users/${user.login}`;

    const userResponse = await fetch(userUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Trendistrict-VC-Platform",
      },
    });

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json();

    return {
      login: userData.login,
      name: userData.name,
      bio: userData.bio,
      company: userData.company,
      location: userData.location,
      publicRepos: userData.public_repos,
      followers: userData.followers,
      following: userData.following,
      createdAt: userData.created_at,
      avatarUrl: userData.avatar_url,
      profileUrl: userData.html_url,
    };
  } catch (error) {
    console.error("GitHub search error:", error);
    return null;
  }
}

// Get user's top languages from their repos
async function getUserLanguages(username: string): Promise<string[]> {
  try {
    const reposUrl = `${GITHUB_API}/users/${username}/repos?sort=pushed&per_page=10`;

    const response = await fetch(reposUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Trendistrict-VC-Platform",
      },
    });

    if (!response.ok) {
      return [];
    }

    const repos = await response.json();

    // Count language occurrences
    const languageCounts: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    }

    // Sort by count and return top languages
    return Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);
  } catch (error) {
    console.error("Error fetching user languages:", error);
    return [];
  }
}

// Get user's organization affiliations
async function getUserOrgs(username: string): Promise<string[]> {
  try {
    const orgsUrl = `${GITHUB_API}/users/${username}/orgs`;

    const response = await fetch(orgsUrl, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Trendistrict-VC-Platform",
      },
    });

    if (!response.ok) {
      return [];
    }

    const orgs = await response.json();
    return orgs.map((org: { login: string }) => org.login);
  } catch (error) {
    console.error("Error fetching user orgs:", error);
    return [];
  }
}

// Calculate technical score based on GitHub profile
function calculateTechnicalScore(
  userData: GitHubUserData,
  languages: string[],
  orgs: string[]
): number {
  let score = 0;

  // Repo count scoring (max 20 points)
  if (userData.publicRepos >= 50) score += 20;
  else if (userData.publicRepos >= 20) score += 15;
  else if (userData.publicRepos >= 10) score += 10;
  else if (userData.publicRepos >= 5) score += 5;

  // Followers scoring (max 25 points) - indicates community recognition
  if (userData.followers >= 1000) score += 25;
  else if (userData.followers >= 500) score += 20;
  else if (userData.followers >= 100) score += 15;
  else if (userData.followers >= 50) score += 10;
  else if (userData.followers >= 10) score += 5;

  // High-value languages (max 20 points)
  const highValueCount = languages.filter(l =>
    HIGH_VALUE_LANGUAGES.includes(l)
  ).length;
  score += Math.min(highValueCount * 5, 20);

  // Major tech org affiliation (max 20 points)
  const majorOrgCount = orgs.filter(o =>
    MAJOR_TECH_ORGS.some(mo => o.toLowerCase().includes(mo))
  ).length;
  score += Math.min(majorOrgCount * 10, 20);

  // Bio contains strong tech signals (max 15 points)
  const bioLower = (userData.bio || "").toLowerCase();
  const companyLower = (userData.company || "").toLowerCase();
  const combinedText = `${bioLower} ${companyLower}`;

  const signalCount = STRONG_TECH_SIGNALS.filter(s =>
    combinedText.includes(s)
  ).length;
  score += Math.min(signalCount * 5, 15);

  return Math.min(score, 100);
}

// Determine contribution level based on activity
function getContributionLevel(
  userData: GitHubUserData
): "high" | "medium" | "low" | "none" {
  // Account age in years
  const accountAge = (Date.now() - new Date(userData.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);

  // Repos per year
  const reposPerYear = userData.publicRepos / Math.max(accountAge, 0.5);

  if (userData.publicRepos === 0) return "none";
  if (reposPerYear >= 10 && userData.followers >= 50) return "high";
  if (reposPerYear >= 5 || userData.followers >= 20) return "medium";
  return "low";
}

// Main enrichment function for a single founder
export const enrichFounderWithGitHub = internalAction({
  args: {
    founderId: v.id("founders"),
  },
  handler: async (ctx, args): Promise<GitHubEnrichmentResult> => {
    // Get founder data
    const founder = await ctx.runQuery(internal.autoSourcingHelpers.getFounder, {
      founderId: args.founderId,
    });

    if (!founder) {
      return { found: false, error: "Founder not found" };
    }

    // Skip if already has GitHub data
    if (founder.githubUrl) {
      return { found: true, githubUrl: founder.githubUrl };
    }

    const location = founder.location?.split(",")[0]; // Use first part of location

    // Search for user on GitHub
    const userData = await searchGitHubUser(
      founder.firstName,
      founder.lastName,
      location
    );

    if (!userData) {
      console.log(`No GitHub profile found for ${founder.firstName} ${founder.lastName}`);
      return { found: false };
    }

    // Small delay to avoid rate limiting
    await sleep(1000);

    // Get additional data
    const [languages, orgs] = await Promise.all([
      getUserLanguages(userData.login),
      getUserOrgs(userData.login),
    ]);

    // Calculate technical score
    const technicalScore = calculateTechnicalScore(userData, languages, orgs);

    // Check for strong tech signals
    const bioLower = (userData.bio || "").toLowerCase();
    const hasStrongTechSignals = STRONG_TECH_SIGNALS.some(s => bioLower.includes(s));

    // Determine contribution level
    const contributionLevel = getContributionLevel(userData);

    // Update founder record with GitHub data
    await ctx.runMutation(internal.githubEnrichmentHelpers.updateFounderWithGitHub, {
      founderId: args.founderId,
      githubData: {
        githubUsername: userData.login,
        githubUrl: userData.profileUrl,
        githubAvatarUrl: userData.avatarUrl,
        publicRepos: userData.publicRepos,
        followers: userData.followers,
        technicalScore,
        primaryLanguages: languages,
        contributionLevel,
      },
    });

    console.log(
      `GitHub enriched: ${founder.firstName} ${founder.lastName} -> ` +
      `@${userData.login} (score: ${technicalScore}, repos: ${userData.publicRepos}, followers: ${userData.followers})`
    );

    return {
      found: true,
      githubUsername: userData.login,
      githubUrl: userData.profileUrl,
      publicRepos: userData.publicRepos,
      followers: userData.followers,
      technicalScore,
      primaryLanguages: languages,
      hasStrongTechSignals,
      orgAffiliations: orgs,
      contributionLevel,
    };
  },
});

// Batch enrich founders for a startup
export const enrichStartupFoundersWithGitHub = internalAction({
  args: {
    startupId: v.id("startups"),
  },
  handler: async (ctx, args) => {
    // Get founders for the startup
    const founders = await ctx.runQuery(internal.autoSourcingHelpers.getFoundersForStartup, {
      startupId: args.startupId,
    });

    let enriched = 0;
    let failed = 0;

    for (const founder of founders) {
      // Skip if already has GitHub data
      if (founder.githubUrl) {
        continue;
      }

      try {
        const result = await ctx.runAction(internal.githubEnrichment.enrichFounderWithGitHub, {
          founderId: founder._id,
        });

        if (result.found) {
          enriched++;
        } else {
          failed++;
        }

        // Rate limit: 10 requests per minute for unauthenticated
        await sleep(6000);
      } catch (error) {
        console.error(`GitHub enrichment failed for founder ${founder._id}:`, error);
        failed++;
      }
    }

    return { enriched, failed, total: founders.length };
  },
});
