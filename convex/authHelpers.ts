import { QueryCtx, MutationCtx } from "./_generated/server";

// Default user ID for demo/unauthenticated access
export const DEFAULT_USER_ID = "demo_user_robbie";

// Get the current user ID (either authenticated or default)
export async function getUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? DEFAULT_USER_ID;
}
