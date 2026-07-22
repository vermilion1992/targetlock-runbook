import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import React from "react";

const AuthRegister = () => {
  return (
    <>
      <form className="mt-6">
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="name" className="font-semibold" >Name</Label>
          </div>
          <Input
            id="name"
            type="text"
            className="form-control"
          />
        </div>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="emadd" className="font-semibold">Email Address</Label>
          </div>
          <Input
            id="emadd"
            type="text"
            className="form-control"
          />
        </div>
        <div className="mb-6">
          <div className="mb-2 block">
            <Label htmlFor="userpwd" className="font-semibold">Password</Label>
          </div>
          <Input
            id="userpwd"
            type="password"
            className="form-control"
          />
        </div>
        <Button className="w-full">Sign Up</Button>
      </form>
    </>
  )
}

export default AuthRegister
