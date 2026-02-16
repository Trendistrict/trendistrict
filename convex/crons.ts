import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============ PIPELINE STAGE 1: DISCOVERY ============
// Find new UK tech startups from Companies House
// Runs every 6 hours, 5 per batch = ~20/day
crons.interval(
  "auto-discovery",
  { hours: 6 },
  internal.backgroundJobs.runScheduledDiscovery
);

// ============ PIPELINE STAGE 2: ENRICHMENT ============
// Enrich discovered startups: LinkedIn profiles via Exa + email discovery via Apollo
// Moves startups from "discovered" → "researching"
crons.interval(
  "auto-enrichment",
  { hours: 2 },
  internal.backgroundJobs.runScheduledEnrichment
);

// ============ PIPELINE STAGE 3: QUALIFICATION ============
// Evaluate "researching" startups and promote good ones to "qualified"
// Based on: team score, sector scalability, stealth signals, education quality
crons.interval(
  "auto-qualification",
  { hours: 3 },
  internal.backgroundJobs.runAutoQualification
);

// ============ PIPELINE STAGE 4: OUTREACH ============
// Auto-queue personalized emails to founders of qualified startups
// Moves startups from "qualified" → "contacted"
crons.interval(
  "auto-outreach",
  { hours: 4 },
  internal.backgroundJobs.runAutoOutreach
);

// Process the outreach queue - actually sends the emails via Resend
// Sends one email per user per run to avoid spam filters
crons.interval(
  "process-outreach-queue",
  { minutes: 30 },
  internal.backgroundJobs.processOutreachQueue
);

// ============ PIPELINE STAGE 5: VC MATCHING ============
// Match qualified/contacted startups with VCs and create introduction records
// Creates intros in "considering" status for high-quality matches (score >= 60)
crons.interval(
  "auto-vc-matching",
  { hours: 4 },
  internal.backgroundJobs.runAutoMatching
);

// ============ VC DISCOVERY ============
// Discover new VCs weekly - curated UK list + email enrichment via Apollo/Hunter
crons.weekly(
  "auto-vc-discovery",
  { dayOfWeek: "sunday", hourUTC: 0, minuteUTC: 0 },
  internal.backgroundJobs.runScheduledVcDiscovery
);

// ============ MAINTENANCE ============
// Clean up old job records daily
crons.daily(
  "cleanup-old-jobs",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backgroundJobs.cleanupOldRecords
);

export default crons;
