import React from "react";
import type { Metadata } from "next";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import BasicLayout from "@/app/components/form-components/form-horizontal/BasicLayout";
import FormSeprator from "@/app/components/form-components/form-horizontal/FormSeprator";
import FormLableAlignment from "@/app/components/form-components/form-horizontal/FormLableAlignment";
import CollapsibalForm from "@/app/components/form-components/form-horizontal/CollapsibalForm";
import FormWithTabs from "@/app/components/form-components/form-horizontal/FormWithTabs";
export const metadata: Metadata = {
  title: "Form Horizontal",
};
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Form Horizontal",
  },
];
const page = () => {
  return (
    <>
      <BreadcrumbComp title="Form Horizontal" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <BasicLayout />
        </div>
        <div className="col-span-12">
          <FormSeprator />
        </div>
        <div className="col-span-12">
          <FormLableAlignment />
        </div>
        <div className="col-span-12">
          <CollapsibalForm />
        </div>
        <div className="col-span-12">
          <FormWithTabs />
        </div>
      </div>
    </>
  );
};

export default page;
