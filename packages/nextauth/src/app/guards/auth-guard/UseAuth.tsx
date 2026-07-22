"use client";
import { useContext } from "react";
import AuthContext from "@/app/context/auth-context";

const useAuth = () => useContext(AuthContext);

export default useAuth;
