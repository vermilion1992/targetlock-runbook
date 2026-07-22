"use client";
import { Activity, useContext } from "react";
import ImagePrompt from "./ImagePrompt";
import GeneratedImageDisplay from "./GeneratedImageDisplay";
import DefaultImageDisplay from "./DefaultImageDisplay";
import { Card } from "@/components/ui/card";
import { ImageContext } from "@/app/context/imageai-context";

function ImageAiApp() {
  const { displayedImages, isGenerating } = useContext(ImageContext);

  const hasGeneratedImages = displayedImages && displayedImages.length > 0;
  return (
    <Card>
      <div className="h-full flex flex-auto flex-col gap-5">
        <ImagePrompt />
        <Activity
          mode={isGenerating || hasGeneratedImages ? "visible" : "hidden"}
        >
          <GeneratedImageDisplay />
        </Activity>
        <DefaultImageDisplay />
      </div>
    </Card>
  );
}

export default ImageAiApp;
