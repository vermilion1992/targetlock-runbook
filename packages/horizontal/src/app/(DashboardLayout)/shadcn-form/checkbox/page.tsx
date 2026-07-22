import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import type { Metadata } from "next";
import CheckboxWithLable from "@/app/components/shadcn-form/checkbox/CheckboxWithLable";
import DefaultChecked from "@/app/components/shadcn-form/checkbox/DefaultChecked";
import DisabledCehckboxes from "@/app/components/shadcn-form/checkbox/DisabledCehckboxes";
import FormCheckbox from "@/app/components/shadcn-form/checkbox/FormCheckbox";
import CheckboxWithText from "@/app/components/shadcn-form/checkbox/CheckboxWithText";

export const metadata: Metadata = {
  title: "Checkbox",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Checkbox",
  },
];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Checkbox" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <CheckboxWithLable />
        </div>
        <div className="col-span-12">
          <DefaultChecked />
        </div>
        <div className="col-span-12">
          <DisabledCehckboxes />
        </div>
        <div className="col-span-12">
          <FormCheckbox />
        </div>
        <div className="col-span-12">
          <CheckboxWithText />
        </div>
      </div>
    </>
  );
};

export default page;
