import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";

const Producttemplate = () => {
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Product Template</h5>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="temp">Select a product template</Label>
            <span className="text-error ms-1">*</span>
          </div>
          <Select required>
            <SelectTrigger id="temp" className="select-md">
              <SelectValue placeholder="Default Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Template</SelectItem>
              <SelectItem value="fashion">Fashion</SelectItem>
              <SelectItem value="stationary">Office Stationary</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
            </SelectContent>
          </Select>
          <small className="text-xs text-darklink">
            Assign a template from your current theme to define how a single
            product is displayed.
          </small>
        </div>
      </Card>
    </>
  );
};

export default Producttemplate;
