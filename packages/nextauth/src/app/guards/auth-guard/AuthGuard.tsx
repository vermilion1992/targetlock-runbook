"use client";
import { redirect, usePathname } from "next/navigation";
import useAuth from "./UseAuth";
import { useEffect } from "react";
type AuthGuardProps = {
  children: React.ReactNode;
};
const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      redirect("/auth/auth1/login");
    }
  }, [isAuthenticated, pathname]);

  return children;
};

export default AuthGuard;
