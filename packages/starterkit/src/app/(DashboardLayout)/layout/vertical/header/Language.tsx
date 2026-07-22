"use client";
import { useContext, useEffect, useState } from "react";

import { CustomizerContext } from "@/app/context/customizer-context";
import Image from "next/image";
import i18n from "@/utils/i18n";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const Languages = [
  {
    flagname: "English (UK)",
    icon: "/images/flag/icon-flag-en.svg",
    value: "en",
  },
  {
    flagname: "中国人 (Chinese)",
    icon: "/images/flag/icon-flag-cn.svg",
    value: "ch",
  },
  {
    flagname: "français (French)",
    icon: "/images/flag/icon-flag-fr.svg",
    value: "fr",
  },
  {
    flagname: "عربي (Arabic)",
    icon: "/images/flag/icon-flag-sa.svg",
    value: "ar",
  },
];

export const Language = () => {
  const { isLanguage, setIsLanguage } = useContext(CustomizerContext);

  const currentLang =
    Languages.find((_lang) => _lang.value === isLanguage) || Languages[1];

  useEffect(() => {
    i18n.changeLanguage(isLanguage);
  }, [isLanguage, i18n]);

  return (
    <div className="relative px-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="relative after:absolute after:w-10 after:-top-1/2 after:h-10 after:rounded-full hover:after:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer">
            <Image
              src={currentLang.icon}
              alt="language"
              width={100}
              height={100}
              className="rounded-full h-5 w-5 shrink-0 object-cover cursor-pointer"
            />
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56 rounded-sm p-1 z-50">
          {Languages.map((item, index) => (
            <DropdownMenuItem
              key={index}
              onSelect={() => setIsLanguage(item.value)}
              className="flex gap-3 items-center py-2 px-4 cursor-pointer hover:bg-muted"
            >
              <Image
                src={item.icon}
                alt={item.flagname}
                className="rounded-full object-cover h-5 w-5"
                width={100}
                height={100}
              />
              <span className="text-sm text-muted-foreground group-hover:text-primary font-medium leading-[25px]">
                {item.flagname}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
