import type { Metadata } from "next";

import { SqlQueryPage } from "@/components/query/sql-query-page";

export const metadata: Metadata = {
  title: "QuestDB Query",
  description: "Run SQL against QuestDB and view CSV results."
};

export default function QueryPage() {
  return <SqlQueryPage />;
}
