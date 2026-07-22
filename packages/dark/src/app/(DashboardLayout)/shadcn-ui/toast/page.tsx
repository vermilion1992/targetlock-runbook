import React from "react";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import { Metadata } from "next";
import TitleToast from "@/app/components/shadcn-ui/toast/TitleToast";
import ActionToast from "@/app/components/shadcn-ui/toast/ActionToast";
import DestructiveToast from "@/app/components/shadcn-ui/toast/DestructiveToast";
import PrimaryToast from "@/app/components/shadcn-ui/toast/PrimaryToast";
import SecondaryToast from "@/app/components/shadcn-ui/toast/SecondaryToast";
import WarningToast from "@/app/components/shadcn-ui/toast/WarningToast";

export const metadata: Metadata = {
  title: "Ui Toast",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Toast",
  },
];
const page = () => {
  return (
    <>
      <BreadcrumbComp title="Toast" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
            <TitleToast/>
        </div>
        <div className="col-span-12">
            <ActionToast/>
        </div>
        <div className="col-span-12">
            <DestructiveToast/>
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <PrimaryToast/>
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <SecondaryToast/>
        </div>
        <div className="lg:col-span-4 md:col-span-6 col-span-12">
          <WarningToast/>
        </div>
      </div>
    </>
  );
};

export default page;
