import type { Metadata } from "next";

import { CompletedHolesList } from "@/components/holes/completed-holes-list";

export const metadata: Metadata = {
  title: "Completed Holes",
};

export default function CompletedHolesPage() {
  return <CompletedHolesList />;
}
