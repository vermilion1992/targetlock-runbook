import { StatePanel } from "@/components/field/state-panel";

export default function HoleLoading() {
  return (
    <StatePanel
      state="loading"
      title="Loading field view"
      description="Preparing this hole’s runbook data on this device."
    />
  );
}
