"use client";

import Image from "next/image";
import React from "react";
import Link from "next/link";
import { demosMegamenu, appsMegamenu } from "../data";
import { IconChevronDown } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const DemosMenu = () => {
  return (
    <div className="relative group/menu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="!py-2 px-4 text-base text-ld hover:text-primary hover:bg-lightprimary rounded-md flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
            Demos <IconChevronDown className="ms-1" size={15} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="center"
          sideOffset={4}
          className="w-screen xl:w-[1150px] rounded-sm p-0 overflow-hidden"
        >
          <div className="xl:p-6 p-3">
            {/* Demos Section */}
            <div className="mb-5">
              <h5 className="card-title">Different Demos</h5>
              <p>Included with the Package</p>
            </div>
            <div className="grid lg:grid-cols-5 grid-cols-1 gap-6">
              {demosMegamenu.map((item) => (
                <div key={item.name}>
                  <div className="overflow-hidden border border-ld rounded-md relative flex justify-center items-center group/card">
                    <div className="relative w-full aspect-video">
                      <Image
                        src={item.img}
                        alt={item.name}
                        fill
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                    {item.include !== "Included With The package" && (
                      <>
                        <Button asChild>
                          <Link
                            href={item.link}
                            target="_blank"
                            className="text-xs absolute left-0 right-0 flex justify-center items-center w-fit mx-auto opacity-0 group-hover/card:opacity-100 transition-opacity z-[1]"
                          >
                            Live Preview
                          </Link>
                        </Button>
                        <div className="absolute top-0 left-0 w-full h-full bg-blue-100 opacity-0 group-hover/card:opacity-60 transition-opacity mix-blend-multiply"></div>
                      </>
                    )}
                  </div>
                  <h5 className="text-center p-3 pb-0 text-sm font-semibold">
                    {item.name}
                  </h5>
                  {item.include === "Included With The package" && (
                    <p className="text-xs text-center text-bodytext">
                      Included With The package
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Apps Section */}
            <div className="mt-8">
              <h5 className="card-title mb-5">Different Apps</h5>
              <div className="grid lg:grid-cols-5 grid-cols-1 gap-6">
                {appsMegamenu.map((item) => (
                  <div key={item.name}>
                    <div className="overflow-hidden border border-ld rounded-md relative flex justify-center items-center group/card">
                      <div className="relative w-full aspect-video">
                        <Image
                          src={item.img}
                          alt={item.name}
                          fill
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                      <Button asChild>
                        <Link
                          href={item.link}
                          className="text-xs absolute left-0 right-0 flex justify-center items-center w-fit mx-auto opacity-0 group-hover/card:opacity-100 transition-opacity z-[1]"
                        >
                          Live Preview
                        </Link>
                      </Button>
                      <div className="absolute top-0 left-0 w-full h-full bg-blue-100 opacity-0 group-hover/card:opacity-60 transition-opacity mix-blend-multiply"></div>
                    </div>
                    <h5 className="text-center p-3 text-sm font-semibold">
                      {item.name}
                    </h5>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default DemosMenu;
