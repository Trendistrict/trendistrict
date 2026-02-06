"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/sourcing');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="text-xl font-bold">Robbie VC Platform</span>
        <p className="text-muted-foreground mt-2">Loading dashboard...</p>
      </div>
    </div>
  );
}

