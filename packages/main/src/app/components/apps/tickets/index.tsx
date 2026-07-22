"use client";
import React from "react";

import { Card } from "@/components/ui/card";
import TicketFilter from "@/app/components/apps/tickets/TicketFilter";
import TicketListing from "@/app/components/apps/tickets/TicketListing";
import { TicketProvider } from "@/app/context/ticket-context/index";

const TicketsApp = () => {
  return (
    <>
      <TicketProvider>
        <Card>
          <TicketFilter />
          <TicketListing />
        </Card>
      </TicketProvider>
    </>
  );
};

export default TicketsApp;
