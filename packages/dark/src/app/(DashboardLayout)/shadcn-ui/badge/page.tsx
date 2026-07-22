import React from 'react'
import BreadcrumbComp from '../../layout/shared/breadcrumb/BreadcrumbComp'
import { Metadata } from 'next';
import DefaultBadge from '@/app/components/shadcn-ui/badge/DefaultBadge';
import OutlineBadge from '@/app/components/shadcn-ui/badge/OutlineBadge';
import LinkBadge from '@/app/components/shadcn-ui/badge/LinkBadge';
import BadgeWithIconText from '@/app/components/shadcn-ui/badge/BadgeWithIconText';
import Iconbadge from '@/app/components/shadcn-ui/badge/IconBadge';

export const metadata: Metadata = {
    title: "Ui Badge",
  };
  
  const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "Badge",
    },
  ];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Badges" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        {/* Basic */}
        <div className="col-span-12">
          <DefaultBadge />
        </div>
        <div className="col-span-12">
          <OutlineBadge />
        </div>
        <div className="col-span-12">
          <LinkBadge />
        </div>
        <div className="col-span-12">
          <BadgeWithIconText />
        </div>
        <div className="col-span-12">
          <Iconbadge />
        </div>
      </div>
    </>
  )
}

export default page