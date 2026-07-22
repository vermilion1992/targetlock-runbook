"use client";
import { Card } from "@/components/ui/card";
import React, { useState } from "react";
import TiptapEdit from "../editor/TiptapEdit";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const GeneralDetail = () => {
  const [text, setText] = useState("");
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">General</h5>
        <div className="mb-4">
          <div className="mb-2 block">
            <Label htmlFor="prednm">Product Name</Label>
            <span className="text-error ms-1">*</span>
          </div>
          <Input
            id="prednm"
            type="text"
            className="form-control"
            placeholder="Product Name"
            value="Super Games"
          />
          <small className="text-xs text-darklink">
            A product name is required and recommended to be unique.
          </small>
        </div>
        <div>
          <div className="mb-2 block">
            <Label htmlFor="desc">Description</Label>
          </div>
          <TiptapEdit />
          <small className="text-xs text-darklink dark:text-bodytext">
            Set a description to the product for better visibility.
          </small>
        </div>
      </Card>
    </>
  );
};

export default GeneralDetail;
