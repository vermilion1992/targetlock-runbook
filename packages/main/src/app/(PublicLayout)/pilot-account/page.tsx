import { PilotAccountSecurity } from "@/components/session/pilot-account-security";
import { requirePilotPageSession } from "@/server/pilot/runtime";

export default async function PilotAccountPage() {
  await requirePilotPageSession("/pilot-account");
  return <PilotAccountSecurity />;
}
