"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
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
