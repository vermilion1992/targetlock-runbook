import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React from "react";

const AuthForgotPassword = () => {
  return (
    <>
      <form className="mt-6">
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="emadd">Email Address</Label>
          </div>
          <Input
            id="emadd"
            type="text"
            className="form-control"
          />
        </div>
        <Button className=" w-full">
          Forgot Password
        </Button>
      </form>
    </>
  );
};

export default AuthForgotPassword;
