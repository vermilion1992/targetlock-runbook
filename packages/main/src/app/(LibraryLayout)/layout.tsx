import type { ReactNode } from "react";

import { LibraryShell } from "@/components/app-shell/library-shell";
import { RequireOperatorSession } from "@/components/session";

export default function ProjectLibraryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireOperatorSession>
      <LibraryShell>{children}</LibraryShell>
    </RequireOperatorSession>
  );
}
