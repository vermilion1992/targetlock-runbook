import type { ReactNode } from "react";

import { RunbookShell } from "@/components/app-shell/runbook-shell";

interface RunbookLayoutProps {
  children: ReactNode;
}

export default function RunbookLayout({ children }: RunbookLayoutProps) {
  return <RunbookShell>{children}</RunbookShell>;
}
