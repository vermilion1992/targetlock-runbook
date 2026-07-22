import React from "react";
import type { Metadata } from "next";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import BasicLayout from "@/app/components/form-components/form-vertical/BasicLayout";
import MulticolFormSeprator from "@/app/components/form-components/form-vertical/MulticolFormSeprator";
import CollapsibleSection from "@/app/components/form-components/form-vertical/CollapsibleSection";
import FormWithTabs from "@/app/components/form-components/form-vertical/FormWithTabs";
export const metadata: Metadata = {
  title: "Form Vertical",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Form Vertical",
  },
];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Form Vertical" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <BasicLayout />
        </div>
        <div className="col-span-12">
          <MulticolFormSeprator />
        </div>
        <div className="col-span-12">
          <CollapsibleSection/>
        </div>
        <div className="col-span-12">
          <FormWithTabs/>
        </div>
      </div>
    </>
  );
};

export default page;
