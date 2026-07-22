"use client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React from "react";
import { Icon } from "@iconify/react";
import FileUploadMotion from "@/app/components/animated-components/FileUploadMotion";
const Thumbnail = () => {
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Thumbnail</h5>
        <div className="flex w-full items-center justify-center">
          <Label
            htmlFor="dropzone-file"
            className="flex  w-full cursor-pointer flex-col items-center justify-center rounded-md border-[1px] border-dashed border-primary bg-lightprimary"
          >
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <Icon
                icon="solar:cloud-upload-outline"
                height={32}
                className="mb-3 text-darklink"
              />
              <p className="mb-2 text-sm text-darklink">
                Drop Thumbnail here to upload
              </p>
            </div>
            <Input type="file" id="dropzone-file" className="hidden" />
          </Label>
        </div>
        <small className="text-xs text-darklink text-center">
          Set the product thumbnail image. Only *.png, *.jpg and *.jpeg image
          files are accepted.
        </small>
      </Card>
    </>
  );
};

export default Thumbnail;
