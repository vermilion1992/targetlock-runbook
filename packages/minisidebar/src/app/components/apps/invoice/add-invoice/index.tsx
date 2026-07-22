"use client";
import { Card } from "@/components/ui/card";
import React from "react";
import CreateInvoice from "@/app/components/apps/invoice/add-invoice/Create";
import { InvoiceProvider } from "@/app/context/invoice-context/index";

function CreateInvoiceApp() {
  return (
    <InvoiceProvider>
      <Card>
        <CreateInvoice />
      </Card>
    </InvoiceProvider>
  );
}
export default CreateInvoiceApp;
