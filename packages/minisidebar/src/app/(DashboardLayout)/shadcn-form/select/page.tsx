import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import type { Metadata } from "next";
import DefaultSelect from "@/app/components/shadcn-form/select/DefaultSelect";
import ScrollableSelect from "@/app/components/shadcn-form/select/ScrollableSelect";
import FormSelect from "@/app/components/shadcn-form/select/FormSelect";

export const metadata: Metadata = {
  title: "Form Select",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Select",
  },
];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Select" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <DefaultSelect />
        </div>
        <div className="col-span-12">
          <ScrollableSelect />
        </div>
        <div className="col-span-12">
          <FormSelect />
        </div>
      </div>
    </>
  );
};

export default page;
