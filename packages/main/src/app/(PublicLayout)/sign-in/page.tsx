import type { Metadata } from "next";

import { SignInScreen } from "@/components/session";
import { resolveSignInDestination } from "@/components/navigation/resolve-sign-in-destination";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Identify the operator using this TargetLock field device.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <SignInScreen destination={resolveSignInDestination(next)} />;
}
