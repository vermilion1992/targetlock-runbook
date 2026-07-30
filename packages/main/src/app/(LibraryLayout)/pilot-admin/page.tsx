import type { Metadata } from "next";

import { PilotAdminSurface } from "@/components/pilot-admin/pilot-admin-surface";

export const metadata: Metadata = {
  title: "Pilot Administration",
  description: "Manage controlled-pilot users, devices, leases and diagnostics.",
};

export default function PilotAdminPage() {
  return <PilotAdminSurface />;
}
