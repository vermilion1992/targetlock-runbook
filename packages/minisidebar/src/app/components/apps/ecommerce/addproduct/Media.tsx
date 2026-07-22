"use client";
import { Card } from "@/components/ui/card";
import FileUploadMotion from "@/app/components/animated-components/FileUploadMotion";
const Media = () => {
  return (
    <>
      <Card>
        <h5 className="card-title mb-4">Media</h5>
        <FileUploadMotion />
      </Card>
    </>
  );
};

export default Media;
