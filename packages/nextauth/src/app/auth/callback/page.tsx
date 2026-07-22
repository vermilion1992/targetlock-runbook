"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../guards/supabase/supabase-client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session retrieval error:", error.message);
        router.push("/auth/auth-code-error");
      } else if (data.session) {
        console.log("User authenticated:", data.session.user);
        router.push("/");
      }
    };

    handleSession();
  }, [router]);

  return <p>Authenticating...</p>;
}
