import React from "react";
import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import EditInvoicePage from "@/app/components/apps/invoice/edit-invoice/index";
import { InvoiceProvider } from "@/app/context/invoice-context/index";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Invoice Edit App",
};
const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Invoice Edit",
  },
];
function EditPage() {
  return (
    <InvoiceProvider>
      <BreadcrumbComp title="Invoice Edit" items={BCrumb} />
      <Card>
        <EditInvoicePage />
      </Card>
    </InvoiceProvider>
  );
}

export default EditPage;
