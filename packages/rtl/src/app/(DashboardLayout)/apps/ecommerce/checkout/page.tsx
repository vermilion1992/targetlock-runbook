import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import ProductCheckout from "@/app/components/apps/ecommerce/checkout/ProductCheckout";
import { Card } from "@/components/ui/card";
import React from "react";
import { ProductProvider } from "@/app/context/ecommerce-context/index";
import { Metadata } from "next";
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Checkout",
  },
];
export const metadata: Metadata = {
  title: "Checkout App",
};

const Checkout = () => {
  return (
    <>
      <ProductProvider>
        <BreadcrumbComp title="Checkout" items={BCrumb} />
        <Card>
          <ProductCheckout />
        </Card>
      </ProductProvider>
    </>
  );
};

export default Checkout;
