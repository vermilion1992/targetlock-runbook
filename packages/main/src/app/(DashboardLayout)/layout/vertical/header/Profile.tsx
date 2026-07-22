import { Icon } from "@iconify/react";

import React, { useContext } from "react";
import * as profileData from "./data";
import Link from "next/link";
import Image from "next/image";
import SimpleBar from "simplebar-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomizerContext } from "@/app/context/customizer-context";

const Profile = () => {
  const { activeDir } = useContext(CustomizerContext);

  return (
    <div className="relative group/menu ps-4">
      <DropdownMenu dir={activeDir === "rtl" ? "rtl" : "ltr"}>
        <DropdownMenuTrigger asChild>
          <span className="hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
            <Image
              src="/images/profile/user-1.jpg"
              alt="logo"
              height="35"
              width="35"
              className="rounded-full"
            />
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-screen sm:w-[360px] py-6 px-0 rounded-sm ">
          {/* Header */}
          <div className="px-6">
            <h3 className="text-lg font-semibold text-ld">User Profile</h3>
            <div className="flex items-center gap-6 pb-5 border-b border-border dark:border-darkborder mt-5 mb-3">
              <Image
                src="/images/profile/user-1.jpg"
                alt="logo"
                height="80"
                width="80"
                className="rounded-full"
              />
              <div>
                <h5 className="card-title text-sm mb-0.5 font-medium">
                  Mathew Anderson
                </h5>
                <span className="card-subtitle text-muted font-normal">
                  Designer
                </span>
                <p className="card-subtitle font-normal text-muted mb-0 mt-1 flex items-center">
                  <Icon
                    icon="tabler:mail"
                    className="text-base me-1 relative top-0.5"
                  />
                  info@tailwindadmin.com
                </p>
              </div>
            </div>
          </div>

          {/* Dropdown items */}
          <SimpleBar>
            {profileData.profileDD.map((items, index) => (
              <DropdownMenuItem
                key={index}
                asChild
                className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full cursor-pointer "
              >
                <Link href={items.url} className="flex items-center w-full">
                  <div className="h-11 w-11 flex-shrink-0 rounded-md flex justify-center items-center bg-lightprimary">
                    <Image src={items.img} alt="icon" width={24} height={24} />
                  </div>
                  <div className="ps-4 flex justify-between w-full">
                    <div className="w-3/4">
                      <h5 className="mb-1 text-sm group-hover/link:text-primary">
                        {items.title}
                      </h5>
                      <div className="text-xs text-darklink">
                        {items.subtitle}
                      </div>
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </SimpleBar>

          {/* Logout Button */}

          <div className="pt-2 px-7">
            <Button color="outlineprimary" className="w-full rounded-md">
              <Link href="/auth/auth1/login"> Logout</Link>
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default Profile;
