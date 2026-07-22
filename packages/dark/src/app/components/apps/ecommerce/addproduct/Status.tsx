'use client'
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";

const Status = () => {
  const [selectedStatus, setSelectedStatus] = useState("Publish");

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h5 className="card-title">Status</h5>
        {selectedStatus === "Publish" ? (
          <Badge variant="success" className="h-3 w-3 p-0"></Badge>
        ) : selectedStatus === "Schedule" ? (
          <Badge variant="secondary" className="h-3 w-3 p-0"></Badge>
        ) : selectedStatus === "Draft" ? (
          <Badge variant="error" className="h-3 w-3 p-0"></Badge>
        ) : (
          <Badge variant="warning" className="h-3 w-3 p-0"></Badge>
        )}
      </div>
      <div>
        <div className="mb-2 block">
          <Label htmlFor="status">Status</Label>
          <span className="text-error ms-1">*</span>
        </div>
        <Select
          value={selectedStatus}
          onValueChange={(value) => setSelectedStatus(value)}
        >
          <SelectTrigger id="status" className="select-md-contact">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Schedule">Schedule</SelectItem>
            <SelectItem value="Publish">Publish</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <small className="text-xs text-darklink">
          Set the product status.
        </small>
      </div>
    </Card>
  );
};

export default Status;