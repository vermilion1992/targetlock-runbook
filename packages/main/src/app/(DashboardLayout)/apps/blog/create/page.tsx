
import BreadcrumbComp from '@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp';

import React from 'react'
import type { Metadata } from "next";
import GeneralDetail from '@/app/components/apps/blog/blogadd/GeneralDetail';

import Media from "@/app/components/apps/blog/blogadd/Media"

import CategoryTags from "@/app/components/apps/blog/blogadd/CategoryTags"
import PostDate from "@/app/components/apps/blog/blogadd/PostDate"
import Status from "@/app/components/apps/blog/blogadd/Status"
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: "Blog Create",
};

const BCrumb = [
    {
        to: "/",
        title: "Home",
    },
    {
        title: "Blog Create",
    },
];
const BlogCreate = () => {
    return (
        <>
            <BreadcrumbComp title="Blog Create" items={BCrumb} />
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
                        <Button className="sm:mb-0 mb-3 w-fit">
                            Add Blog
                        </Button>
                        <Button variant={"lighterror"} className="w-fit">
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>

        </>
    )
}

export default BlogCreate
