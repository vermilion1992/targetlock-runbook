import type { Metadata } from "next";

import { StartWorkspace } from "@/components/session";

export const metadata: Metadata = {
  title: "Start",
  description: "Continue a hole or start new drilling work.",
};

export default function StartPage() {
  return <StartWorkspace />;
}
