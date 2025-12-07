import Home from "./inner";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function ServerPage() {
  let preloaded;
  let data;

  try {
    preloaded = await preloadQuery(api.myFunctions.listNumbers, {
      count: 3,
    });
    data = preloadedQueryResult(preloaded);
  } catch {
    // Handle case when Convex is not available during build
    preloaded = null;
    data = { viewer: null, numbers: [] };
  }

  return (
    <main className="p-8 flex flex-col gap-4 mx-auto max-w-2xl">
      <h1 className="text-4xl font-bold text-center">Convex + Next.js</h1>
      <div className="flex flex-col gap-4 bg-card p-4 rounded-md border border-border">
        <h2 className="text-xl font-bold">Non-reactive server-loaded data</h2>
        <code>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </code>
      </div>
      {preloaded && <Home preloaded={preloaded} />}
    </main>
  );
}
