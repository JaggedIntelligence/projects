import { BookOpenText, LineChart } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <main className="container py-10">
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal">Welcome to Stock Portfolios</h1>
          <p className="text-muted-foreground">Dashboard is still being finalized. For now, jump into these pages.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/concepts">
              <BookOpenText className="h-4 w-4" />
              Concepts
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/plots2">
              <LineChart className="h-4 w-4" />
              Plots2
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
