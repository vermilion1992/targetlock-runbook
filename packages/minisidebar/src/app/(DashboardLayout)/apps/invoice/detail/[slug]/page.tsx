import React from "react";
import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import { InvoiceProvider } from "@/app/context/invoice-context/index";
import InvoiceDetail from "@/app/components/apps/invoice/invoice-detail/index";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Invoice Details App ",
};
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Invoice Details",
  },
];

function InvoiceDetailPage() {
  return (
    <InvoiceProvider>
      <BreadcrumbComp title="Invoice Details" items={BCrumb} />
      <Card>
        <InvoiceDetail />
      </Card>
    </InvoiceProvider>
  );
}
export default InvoiceDetailPage;
