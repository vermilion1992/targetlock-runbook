import { StatePanel } from "@/components/field/state-panel";

export default function HoleLoading() {
  return (
    <StatePanel
      state="loading"
      title="Loading field view"
      description="Preparing the locally available Stage 1 seed data."
    />
  );
}
