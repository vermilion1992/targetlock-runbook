"use client";

import { useContext, useEffect } from "react";
import { CustomFooter } from "../components/frontend-pages/layout/CustomFooter";
import { AnnouncementBar } from "../components/frontend-pages/layout/header/AnnouncementBar";
import Header from "../components/frontend-pages/layout/header/Header";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="frontend-page">
      <AnnouncementBar />
      <Header />
      <main>{children}</main>
      <CustomFooter />
    </div>
  );
}
