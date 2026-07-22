"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import AuthContext from "@/app/context/auth-context";

const AuthLogin = () => {
  const [email, setEmail] = useState<string>("demo1234@gmail.com");
  const [password, setPassword] = useState<string>("demo1234");
  const [error, setError] = useState<string>("");

  const router = useRouter();
  const { signin } = useContext(AuthContext);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    try {
      await signin(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    }
  };

  return (
    <>
      <form className="mt-6" onSubmit={handleSubmit}>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="Username">Email</Label>
          </div>
          <Input
            id="Email"
            type="text"
            value={email}
            className={`form-control ${
              error !== "" ? "border border-error rounded-md" : ""
            }`}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="userpwd">Password</Label>
          </div>
          <Input
            id="userpwd"
            type="password"
            value={password}
            className={`form-control ${
              error !== "" ? "border border-error rounded-md" : ""
            }`}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex justify-between my-5">
          <div className="flex items-center gap-2">
            <Checkbox id="accept" className="checkbox" />
            <Label
              htmlFor="accept"
              className="opacity-90 font-normal cursor-pointer mb-0"
            >
              Remeber this Device
            </Label>
          </div>
          <Link
            href={"/auth/auth1/forgot-password"}
            className="text-primary text-sm font-medium"
          >
            Forgot Password ?
          </Link>
        </div>
        <Button className="w-full" type="submit">
          Sign in
        </Button>
      </form>
    </>
  );
};

export default AuthLogin;
