"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignUpButton } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  return (
    <>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  );
}

function RedirectToDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.push('/tasks');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="text-xl font-mona-bold">VIBED</span>
        <p className="text-muted-foreground mt-2">Redirecting to tasks...</p>
      </div>
    </div>
  );
}

function SignInForm() {
  return (
    <div className="max-w-md mx-auto text-center">
      <h1 className="text-3xl font-mona-heading mb-2">Welcome to VIBED</h1>
      <p className="text-muted-foreground mb-8">Sign in to start organizing your tasks</p>
      <div className="flex flex-col gap-3">
        <SignInButton mode="modal">
          <button className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="w-full px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors">
            Create account
          </button>
        </SignUpButton>
      </div>
    </div>
  );
}

