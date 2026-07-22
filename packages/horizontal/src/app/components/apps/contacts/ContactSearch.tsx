"use client";
import React, { useContext } from "react";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { ContactContext } from "@/app/context/conatact-context/index";

type Props = {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
};

const ContactSearch = ({ onClick }: Props) => {
  const { searchTerm, updateSearchTerm } = useContext(ContactContext);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSearchTerm(e.target.value);
  };

  return (
    <>
      <div className="flex gap-3 bg-white dark:bg-transparent px-6 py-5 items-center">
        <Button
          variant={"lightprimary"}
          className="btn-circle rounded-md p-0 lg:!hidden flex"
          onClick={onClick}
        >
          <Icon icon="tabler:menu-2" height={18} />
        </Button>
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Icon icon="solar:magnifer-line-duotone" height={18} />
          </span>
          <Input
            id="search"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search Contacts"
            className="pl-9 w-full"
            required
          />
        </div>
      </div>
    </>
  );
};
export default ContactSearch;
