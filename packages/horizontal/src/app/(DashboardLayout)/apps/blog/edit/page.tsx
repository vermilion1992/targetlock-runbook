import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";

import React from "react";
import { BlogProvider } from "@/app/context/blog-context/index";
import type { Metadata } from "next";
import CategoryTags from "@/app/components/apps/blog/blogedit/CategoryTags";
import GeneralDetail from "@/app/components/apps/blog/blogedit/GeneralDetail";
import Media from "@/app/components/apps/blog/blogedit/Media";
import PostDate from "@/app/components/apps/blog/blogedit/PostDate";
import Status from "@/app/components/apps/blog/blogedit/Status";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Blog Edit",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Blog Edit",
  },
];
const BlogEdit = () => {
  return (
    <>
      <BlogProvider>
        <BreadcrumbComp title="Blog Edit" items={BCrumb} />
        <div className="grid grid-cols-12 gap-[30px]">
          <div className="lg:col-span-8 col-span-12">
            <div className="flex flex-col gap-[30px]">
              {/* General */}
              <GeneralDetail />
              {/* Media  */}
              <Media />
            </div>
          </div>
          <div className="lg:col-span-4 col-span-12">
            <div className="flex flex-col gap-[30px]">
              {/* Status */}
              <Status />
              {/* CategoryTags */}
              <CategoryTags />
              {/* PostDate */}
              <PostDate />
            </div>
          </div>
          <div className="lg:col-span-8 col-span-12">
            <div className="sm:flex gap-3">
              <Button className="sm:mb-0 mb-3 w-fit">Save changes</Button>
              <Button variant={"lighterror"} className="w-fit">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </BlogProvider>
    </>
  );
};

export default BlogEdit;
