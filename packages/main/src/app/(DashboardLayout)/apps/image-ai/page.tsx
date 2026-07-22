import React from "react";
import type { Metadata } from "next";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import ImageAiApp from "@/app/components/apps/image-ai";
import { ImageAiProvider } from "@/app/context/imageai-context";

export const metadata: Metadata = {
  title: "Image-AI",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Image-AI",
  },
];

function ImageAI() {
  return (
    <>
      <ImageAiProvider>
        <BreadcrumbComp title="Image-AI" items={BCrumb} />
        <ImageAiApp />
      </ImageAiProvider>
    </>
  );
}

export default ImageAI;
