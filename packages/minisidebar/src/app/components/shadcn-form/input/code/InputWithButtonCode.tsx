import React from 'react'
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
const InputWithButtonCode = () => {
  return (
    <>
      <div className="max-w-sm flex flex-col gap-5 mt-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input type="text" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input type="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input type="password" />
        </div>
        <div className="flex gap-3">
          <Button>Submit</Button>
          <Button variant={"error"}>Cancel</Button>
        </div>
      </div>
    </>
  )
}

export default InputWithButtonCode