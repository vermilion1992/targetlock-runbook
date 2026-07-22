import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React from "react";

const AuthTwoSteps = () => {
  return (
    <>
      <form className="mt-6">
        <div className="mb-4">
          <div className="mb-2 block">
            <Label>Type your 6 digits security code</Label>
          </div>
          <div className="flex gap-3.5">
            <Input type="text" className="text-center" />
            <Input type="text" className="text-center" />
            <Input type="text" className="text-center" />
            <Input type="text" className="text-center" />
            <Input type="text" className="text-center" />
            <Input type="text" className="text-center" />
          </div>
        </div>
        <Button className="w-full">
          Verify My Account
        </Button>
      </form>
    </>
  );
};

export default AuthTwoSteps;
