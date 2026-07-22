"use client";
import { useState } from "react";
import ContactFilter from "@/app/components/apps/contacts/ContactFilter";
import ContactSearch from "@/app/components/apps/contacts/ContactSearch";
import { ContactContextProvider } from "@/app/context/conatact-context";
import ContactListItem from "@/app/components/apps/contacts/ContactListItem";
import ContactList from "@/app/components/apps/contacts/ContactList";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const index = () => {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);
  const [isOpenContact, setIsOpenContact] = useState(false);

  return (
    <>
      <ContactContextProvider>
        <Card className="p-0 overflow-hidden">
          <div className="flex">
            {/* ------------------------------------------- */}
            {/* Left Part */}
            {/* ------------------------------------------- */}
            <Sheet open={isOpen} onOpenChange={handleClose}>
              <SheetContent
                side="left"
                className="max-w-[230px] sm:max-w-[230px] w-full h-full lg:z-0 lg:hidden block"
              >
                <VisuallyHidden>
                  <SheetTitle>title</SheetTitle>
                </VisuallyHidden>
                <ContactFilter />
              </SheetContent>
            </Sheet>
            <div className="max-w-[230px] sm:max-w-[230px] w-full h-auto lg:block hidden">
              <ContactFilter />
            </div>

            {/* ------------------------------------------- */}
            {/* Middle part */}
            {/* ------------------------------------------- */}
            <div className="left-part lg:max-w-[340px] max-w-full lg:border-e lg:border-ld border-e-0  w-full px-0 pt-0">
              <ContactSearch onClick={() => setIsOpen(true)} />
              <ContactList openContact={setIsOpenContact} />
            </div>

            {/* ------------------------------------------- */}
            {/* Detail part */}
            {/* ------------------------------------------- */}
            <ContactListItem
              openContactValue={isOpenContact}
              onCloseContact={() => setIsOpenContact(false)}
            />
          </div>
        </Card>
      </ContactContextProvider>
    </>
  );
};

export default index;
