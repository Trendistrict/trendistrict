import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run auto-discovery every 6 hours to find new startups
// This respects the daily limit of 20 startups by running in batches
crons.interval(
  "auto-discovery",
  { hours: 6 },
  internal.backgroundJobs.runScheduledDiscovery
);

// Run enrichment every 2 hours to process discovered startups
crons.interval(
  "auto-enrichment",
  { hours: 2 },
  internal.backgroundJobs.runScheduledEnrichment
);

// Process outreach queue every 30 minutes
// Sends one email at a time to avoid spam filters
crons.interval(
  "process-outreach-queue",
  { minutes: 30 },
  internal.backgroundJobs.processOutreachQueue
);

// Clean up old job records daily
crons.daily(
  "cleanup-old-jobs",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backgroundJobs.cleanupOldRecords
);

export default crons;
