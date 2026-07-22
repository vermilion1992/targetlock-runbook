import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import { Metadata } from 'next';
import BasicBreadcrumb from '@/app/components/shadcn-ui/breadcrumb/BasicBreadcrumb';
import BreadcrumbWithSeparator from '@/app/components/shadcn-ui/breadcrumb/BreadcrumbWithSeparator';
import BreadcrumbWithDropdown from '@/app/components/shadcn-ui/breadcrumb/BreadcrumbWithDropdown';
import BreadcrumbWithEllipsis from '@/app/components/shadcn-ui/breadcrumb/BreadcrumbWithEllipsis';



export const metadata: Metadata = {
    title: "Ui Breadcrumb",
  };
  
  const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "Breadcrumb",
    },
  ];
const page = () => {
  return (
    <>
    <BreadcrumbComp title="Breadcrumb" items={BCrumb} />
    <div className="grid grid-cols-12 gap-6">
      {/* Basic */}
      <div className="col-span-12">
        <BasicBreadcrumb/>
      </div>
       <div className="col-span-12">
        <BreadcrumbWithSeparator/>
      </div>
      <div className="col-span-12">
        <BreadcrumbWithDropdown/>
      </div>
      <div className="col-span-12">
        <BreadcrumbWithEllipsis/>
      </div>
     

    </div>
  </>
  )
}

export default page