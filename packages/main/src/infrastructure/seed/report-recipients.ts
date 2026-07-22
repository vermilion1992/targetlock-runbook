import type { SavedReportRecipient } from "@/domain";

/** Stage 6 local defaults. Legacy SentReport seed remains unused by Report Centre. */
export const stage6DefaultRecipients: readonly SavedReportRecipient[] = [
  {
    id: "saved-recipient-ops",
    projectId: "project-briggs",
    displayName: "Briggs Operations",
    email: "operations@briggs.example",
    scope: "PROJECT",
    isDefault: true,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    syncStatus: "local-only",
    version: 1,
  },
  {
    id: "saved-recipient-supervisor",
    projectId: "project-briggs",
    holeId: "DDH041",
    displayName: "Morgan Lee",
    email: "supervisor@briggs.example",
    scope: "HOLE",
    isDefault: true,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    syncStatus: "local-only",
    version: 1,
  },
];
