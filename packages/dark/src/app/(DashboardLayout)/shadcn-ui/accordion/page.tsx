import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import type { Metadata } from "next";
import BasicAccordion from "@/app/components/shadcn-ui/accordion/BasicAccordion";
export const metadata: Metadata = {
  title: "Ui Accordion",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Accordion",
  },
];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Accordion" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        {/* Basic */}
        <div className="col-span-12">
          <BasicAccordion />
        </div>
      </div>
    </>
  );
};

export default page;