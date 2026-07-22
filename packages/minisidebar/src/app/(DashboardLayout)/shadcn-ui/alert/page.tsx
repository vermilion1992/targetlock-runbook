import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import BasicAlert from '@/app/components/shadcn-ui/alert/BasicAlert';
import { Metadata } from 'next';
import LightAlert from '@/app/components/shadcn-ui/alert/LightAlert';
export const metadata: Metadata = {
    title: "Alert",
  };

const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "Alert",
    },
  ];
const page = () => {
  return (
    <>
      <BreadcrumbComp title="Alerts" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        {/* Basic */}
        <div className="col-span-12">
          <BasicAlert/>
        </div>
        <div className="col-span-12">
          <LightAlert/>
        </div>
      </div>
    </>
  )
}

export default page