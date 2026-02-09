/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authHelpers from "../authHelpers.js";
import type * as autoSourcing from "../autoSourcing.js";
import type * as autoSourcingHelpers from "../autoSourcingHelpers.js";
import type * as backgroundJobs from "../backgroundJobs.js";
import type * as backgroundJobsDb from "../backgroundJobsDb.js";
import type * as companiesHouse from "../companiesHouse.js";
import type * as crons from "../crons.js";
import type * as founders from "../founders.js";
import type * as introductions from "../introductions.js";
import type * as jobHelpers from "../jobHelpers.js";
import type * as lib_jobManager from "../lib/jobManager.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as outreach from "../outreach.js";
import type * as outreachQueue from "../outreachQueue.js";
import type * as settings from "../settings.js";
import type * as startups from "../startups.js";
import type * as vcConnections from "../vcConnections.js";
import type * as vcDiscovery from "../vcDiscovery.js";
import type * as vcDiscoveryHelpers from "../vcDiscoveryHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authHelpers: typeof authHelpers;
  autoSourcing: typeof autoSourcing;
  autoSourcingHelpers: typeof autoSourcingHelpers;
  backgroundJobs: typeof backgroundJobs;
  backgroundJobsDb: typeof backgroundJobsDb;
  companiesHouse: typeof companiesHouse;
  crons: typeof crons;
  founders: typeof founders;
  introductions: typeof introductions;
  jobHelpers: typeof jobHelpers;
  "lib/jobManager": typeof lib_jobManager;
  "lib/rateLimiter": typeof lib_rateLimiter;
  outreach: typeof outreach;
  outreachQueue: typeof outreachQueue;
  settings: typeof settings;
  startups: typeof startups;
  vcConnections: typeof vcConnections;
  vcDiscovery: typeof vcDiscovery;
  vcDiscoveryHelpers: typeof vcDiscoveryHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
