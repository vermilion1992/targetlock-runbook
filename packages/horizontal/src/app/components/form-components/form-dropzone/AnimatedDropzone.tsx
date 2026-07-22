"use client";

import TitleCard from "@/app/components/shared/TitleBorderCard";
import FileUploadMotion from "@/app/components/animated-components/FileUploadMotion";

const AnimatedDropzone = () => {
  return (
    <>
      <TitleCard title="Animated Dropzone">
        <div>
          <FileUploadMotion />
        </div>
      </TitleCard>
    </>
  );
};

export default AnimatedDropzone;
