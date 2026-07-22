"use client";
import { Input } from "@/components/ui/input";
import React, { useContext } from "react";
import { Icon } from "@iconify/react";
import { EmailContext } from "@/app/context/email-context/index";
import { Button } from "@/components/ui/button";
import PlaceholdersInput from "@/app/components/animated-components/AnimatedInputPlaceholder";

type Props = {
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
};
const EmailSearch = ({ onClick }: Props) => {
  const { setSearchQuery, searchQuery } = useContext(EmailContext);

  const handleSearchChange = (event: { target: { value: string } }) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);
  };

  return (
    <>
      <div className="flex gap-3 bg-white dark:bg-transparent px-6 py-5 items-center">
        <Button
          variant={"lightprimary"}
          className="btn-circle p-0 lg:!hidden flex"
          onClick={onClick}
        >
          <Icon icon="tabler:menu-2" height={18} />
        </Button>
        <div className="relative w-full">
          <Icon
            icon="solar:magnifer-line-duotone"
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext dark:text-darklink"
          />
          <PlaceholdersInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholders={[
              "Search Mail...",
              "Find From Your Mails...",
              "Look up Mails...",
            ]}
          />
        </div>
      </div>
    </>
  );
};

export default EmailSearch;
