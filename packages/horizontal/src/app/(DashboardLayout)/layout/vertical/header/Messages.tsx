import { Icon } from "@iconify/react";
import Link from "next/link";
import * as MessagesData from "./data";
import React, { useContext } from "react";
import Image from "next/image";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CustomizerContext } from "@/app/context/customizer-context";

const Messages = () => {
  const { activeDir } = useContext(CustomizerContext);

  return (
    <div className="relative group/menu px-4">
      <DropdownMenu dir={activeDir === "rtl" ? "rtl" : "ltr"}>
        <DropdownMenuTrigger asChild>
          <div className="relative">
            <span className="relative after:absolute after:w-10 after:h-10 after:rounded-full hover:text-primary after:-top-1/2 hover:after:bg-lightprimary text-link dark:text-darklink rounded-full flex justify-center items-center cursor-pointer group-hover/menu:after:bg-lightprimary group-hover/menu:!text-primary">
              <Icon icon="tabler:bell-ringing" height={20} />
            </span>
            <span className="rounded-full absolute -end-[6px] -top-[5px]  text-[10px] h-2 w-2 bg-primary flex justify-center items-center"></span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-screen sm:w-[360px] py-6  rounded-sm">
          <div className="flex items-center  px-6 justify-between">
            <h3 className="mb-0 text-lg font-semibold text-ld">Notification</h3>
            <Badge variant="primary">5 new</Badge>
          </div>
          <SimpleBar className="max-h-80 mt-3">
            {MessagesData.MessagesLink.map((links, index) => (
              <DropdownMenuItem
                className="px-6 py-3 flex justify-between items-center bg-hover group/link w-full"
                key={index}
              >
                <Link href="#">
                  <div className="flex items-center">
                    <span className="flex-shrink-0 relative">
                      <Image
                        src={links.avatar}
                        width={45}
                        height={45}
                        alt="tailwind-admin"
                        className="rounded-full"
                      />
                    </span>
                    <div className="ps-4">
                      <h5 className="mb-1 text-sm  group-hover/link:text-primary">
                        {links.title}
                      </h5>
                      <span className="text-xs block  truncate text-darklink">
                        {links.subtitle}
                      </span>
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </SimpleBar>

          <div className="pt-5 px-6">
            <Link
              href="/apps/email"
              className="w-full border border-primary text-primary hover:bg-primary hover:text-white rounded-md py-2 px-4 block text-center"
            >
              See All Notifications
            </Link>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default Messages;
