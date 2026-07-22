import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import React from "react";
import { BlogProvider } from "@/app/context/blog-context/index";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import ManageBlogTable from "@/app/components/apps/blog/blogtable/ManageBlogTable";
export const metadata: Metadata = {
  title: "Manage Blog ",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Manage Blog",
  },
];
const MangeBlog = () => {
  return (
    <>
      <BlogProvider>
        <BreadcrumbComp title=" Manage Blog" items={BCrumb} />
        <Card>
          <ManageBlogTable />
        </Card>
      </BlogProvider>
    </>
  );
};

export default MangeBlog;
