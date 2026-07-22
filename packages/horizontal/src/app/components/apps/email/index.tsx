"use client";
import { Card } from "@/components/ui/card";
import React, { useState } from "react";
import EmailFilter from "@/app/components/apps/email/EmailFilter";
import EmailSearch from "@/app/components/apps/email/EmailSearch";
import EmailList from "@/app/components/apps/email/EmailList";
import EmailContent from "@/app/components/apps/email/EmailContent";
import { EmailContextProvider } from "@/app/context/email-context/index";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const EmaiilApp = () => {
  const [isOpenEmail, setIsOpenEmail] = useState(false);
  const handleCloseEmail = () => setIsOpenEmail(false);

  const [isOpenMail, setIsOpenMail] = useState(false);
  return (
    <>
      <EmailContextProvider>
        <Card className="p-0 overflow-hidden h-[600px]">
          <div className="flex">
            {/* ------------------------------------------- */}
            {/* Left Part */}
            {/* ------------------------------------------- */}
            <Sheet open={isOpenEmail} onOpenChange={handleCloseEmail}>
              <SheetContent
                side="left"
                className="max-w-60 sm:max-w-60 w-full h-full lg:z-0 lg:hidden block"
              >
                <VisuallyHidden>
                  <SheetTitle>title</SheetTitle>
                </VisuallyHidden>
                <EmailFilter />
              </SheetContent>
            </Sheet>
            <div className="max-w-60 sm:max-w-60 w-full h-auto lg:block hidden">
              <EmailFilter />
            </div>

            {/* ------------------------------------------- */}
            {/* Middle part */}
            {/* ------------------------------------------- */}
            <div className="left-part lg:max-w-[340px] max-w-full md:border-e md:border-ld border-e-0  w-full px-0 pt-0">
              <EmailSearch onClick={() => setIsOpenEmail(true)} />
              <EmailList openMail={setIsOpenMail} />
            </div>
            {/* ------------------------------------------- */}
            {/* Detail part */}
            {/* ------------------------------------------- */}
            <EmailContent
              openMailValue={isOpenMail}
              onCloseMail={() => setIsOpenMail(false)}
            />
          </div>
        </Card>
      </EmailContextProvider>
    </>
  );
};
export default EmaiilApp;
