import React from "react";
import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import GeneralDetail from "@/app/components/apps/ecommerce/addproduct/GeneralDetail";
import Media from "@/app/components/apps/ecommerce/addproduct/Media";
import Variation from "@/app/components/apps/ecommerce/addproduct/Variation";
import Pricing from "@/app/components/apps/ecommerce/addproduct/Pricing";
import { Button } from "@/components/ui/button";
import Thumbnail from "@/app/components/apps/ecommerce/addproduct/Thumbnail";
import Status from "@/app/components/apps/ecommerce/addproduct/Status";
import ProductData from "@/app/components/apps/ecommerce/addproduct/ProductData";
import Producttemplate from "@/app/components/apps/ecommerce/addproduct/ProductTemplate";
import { Metadata } from "next";
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Add Product",
  },
];
export const metadata: Metadata = {
  title: "Add Product",
};
const AddProduct = () => {
  return (
    <>
      <BreadcrumbComp title="Add Product" items={BCrumb} />
      <div className="grid grid-cols-12 gap-6">
        <div className="lg:col-span-8 col-span-12">
          <div className="flex flex-col gap-6">
            {/* General */}
            <GeneralDetail />
            {/* Media  */}
            <Media />
            {/* Variation  */}
            <Variation />
            {/* Pricing  */}
            <Pricing />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="flex flex-col gap-6">
            {/* Thumbnail */}
            <Thumbnail />
            {/* Status */}
            <Status />
            {/* ProductData */}
            <ProductData />
            {/* Producttemplate */}
            <Producttemplate />
          </div>
        </div>
        <div className="lg:col-span-8 col-span-12">
          <div className="sm:flex gap-3">
            <Button className="sm:mb-0 mb-3 w-fit">
              Save changes
            </Button>
            <Button variant={"lighterror"} className="w-fit">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddProduct;
