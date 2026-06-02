"use client";

import { UserButton } from "@clerk/nextjs";
import { Moon, Plus, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/trading", label: "Trading" }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="truncate text-base font-semibold">
              Task Management
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <Button key={item.href} asChild variant={pathname === item.href ? "secondary" : "ghost"} size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
      
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
        <nav className="container grid grid-cols-3 gap-2 pb-3 sm:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-center text-sm font-medium",
                pathname === item.href ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
