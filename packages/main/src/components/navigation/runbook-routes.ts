export const DEFAULT_HOLE_ID = "DDH041";

function usableHoleId(holeId: string | null | undefined): string {
  const value = holeId?.trim();
  return value ? value.slice(0, 64) : DEFAULT_HOLE_ID;
}

function holeBase(holeId: string): string {
  return `/holes/${encodeURIComponent(usableHoleId(holeId))}`;
}

export const runbookRoutes = {
  currentHole: (holeId: string) => `${holeBase(holeId)}/current`,
  recordRun: (holeId: string) => `${holeBase(holeId)}/runs/new`,
  runDetail: (holeId: string, runId: string) =>
    `${holeBase(holeId)}/runs/${encodeURIComponent(runId)}`,
  runbook: (holeId: string) => `${holeBase(holeId)}/runbook`,
  shifts: (holeId: string) => `${holeBase(holeId)}/shifts`,
  startShift: (holeId: string) => `${holeBase(holeId)}/shifts/start`,
  shiftDetail: (holeId: string, shiftId: string) =>
    `${holeBase(holeId)}/shifts/${encodeURIComponent(shiftId)}`,
  closeShift: (holeId: string, shiftId: string) =>
    `${holeBase(holeId)}/shifts/${encodeURIComponent(shiftId)}/close`,
  handover: (holeId: string) => `${holeBase(holeId)}/handover`,
  casing: (holeId: string) => `${holeBase(holeId)}/casing`,
  addCasing: (holeId: string) => `${holeBase(holeId)}/casing/new`,
  casingDetail: (holeId: string, casingId: string) =>
    `${holeBase(holeId)}/casing/${encodeURIComponent(casingId)}`,
  advanceCasing: (holeId: string, casingId: string) =>
    `${holeBase(holeId)}/casing/${encodeURIComponent(casingId)}/advance`,
  correctCasing: (holeId: string, casingId: string) =>
    `${holeBase(holeId)}/casing/${encodeURIComponent(casingId)}/correct`,
  holeComponents: (holeId: string) => `${holeBase(holeId)}/components`,
  changeBit: (holeId: string) =>
    `${holeBase(holeId)}/components/bit/change`,
  changeReamer: (holeId: string) =>
    `${holeBase(holeId)}/components/reamer/change`,
  assignComponent: (holeId: string, type: "bit" | "reamer") =>
    `${holeBase(holeId)}/components/${type}/assign`,
  componentRegistry: () => "/components",
  addComponent: (type?: "BIT" | "REAMER") =>
    type === undefined ? "/components/new" : `/components/new?type=${type}`,
  componentDetail: (componentId: string) =>
    `/components/${encodeURIComponent(componentId)}`,
  surveys: (holeId: string) => `${holeBase(holeId)}/surveys`,
  addSurvey: (holeId: string) => `${holeBase(holeId)}/surveys/new`,
  surveyDetail: (holeId: string, surveyId: string) =>
    `${holeBase(holeId)}/surveys/${encodeURIComponent(surveyId)}`,
  correctSurvey: (holeId: string, surveyId: string) =>
    `${holeBase(holeId)}/surveys/${encodeURIComponent(surveyId)}/correct`,
  surveyTools: (holeId: string) => `${holeBase(holeId)}/surveys/tools`,
  trays: (holeId: string) => `${holeBase(holeId)}/trays`,
  addTray: (holeId: string) => `${holeBase(holeId)}/trays/new`,
  trayDetail: (holeId: string, trayId: string) =>
    `${holeBase(holeId)}/trays/${encodeURIComponent(trayId)}`,
  correctTray: (holeId: string, trayId: string) =>
    `${holeBase(holeId)}/trays/${encodeURIComponent(trayId)}/correct`,
  replaceTrayPhoto: (holeId: string, trayId: string) =>
    `${holeBase(holeId)}/trays/${encodeURIComponent(trayId)}/replace-photo`,
  timeline: (holeId: string) => `${holeBase(holeId)}/timeline`,
  more: (holeId: string) => `${holeBase(holeId)}/more`,
  completeHole: (holeId: string) => `${holeBase(holeId)}/complete`,
  reopenHole: (holeId: string) => `${holeBase(holeId)}/reopen`,
  completedHoles: () => "/holes/completed",
  reports: (holeId: string) => `${holeBase(holeId)}/reports`,
  reportHistory: (holeId: string) => `${holeBase(holeId)}/reports/history`,
} as const;

export function holeIdFromPathname(pathname: string | null): string {
  const encodedHoleId = pathname?.match(/(?:^|\/)holes\/([^/?#]+)/i)?.[1];

  if (!encodedHoleId) {
    return DEFAULT_HOLE_ID;
  }

  try {
    return usableHoleId(decodeURIComponent(encodedHoleId));
  } catch {
    return usableHoleId(encodedHoleId);
  }
}

export function isRunbookRouteActive(
  pathname: string,
  href: string,
): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
