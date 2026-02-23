"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm max-w-md text-center" style={{ color: "#888" }}>
        {error.message}
      </p>
      {error.digest && (
        <p className="text-xs" style={{ color: "#666" }}>Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        style={{
          padding: "8px 16px",
          borderRadius: "6px",
          border: "1px solid #333",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
