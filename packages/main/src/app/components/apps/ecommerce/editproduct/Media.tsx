"use client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React from "react";
import { Icon } from "@iconify/react";
import FileUploadMotion from "@/app/components/animated-components/FileUploadMotion";
const Media = () => {
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Media</h5>

        {/* <div className="flex w-full items-center justify-center">
          <Label
            htmlFor="dropzone-file"
            className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-md border-[1px] border-dashed border-primary bg-lightprimary"
          >
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <Icon
                icon="solar:cloud-upload-outline"
                height={32}
                className="mb-3 text-darklink"
              />
              <p className="mb-2 text-sm text-darklink">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-darklink">
                SVG, PNG, JPG or GIF (MAX. 800x400px)
              </p>
            </div>
            <Input type="file" id="dropzone-file" className="hidden" />
          </Label>
        </div> */}
        <FileUploadMotion />
      </Card>
    </>
  );
};

export default Media;
