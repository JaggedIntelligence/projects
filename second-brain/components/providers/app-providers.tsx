"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isMissingClerkKey = !clerkPublishableKey || clerkPublishableKey.includes("replace_me");

  if (isMissingClerkKey) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <div className="max-w-xl space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Clerk environment keys are required</h1>
            <p className="text-sm text-muted-foreground">
              Create a Clerk application, copy <code>.env.example</code> to <code>.env.local</code>, and replace the
              placeholder Clerk values before starting the app.
            </p>
          </div>
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ClerkProvider>
      <TRPCProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </TRPCProvider>
    </ClerkProvider>
  );
}
