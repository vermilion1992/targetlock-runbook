"use client";
import Link from "next/link";
import React from "react";
import Image from "next/image";

interface MyAppProps {
  title?: string;
}

const SocialButtons: React.FC<MyAppProps> = ({ title }) => {
  return (
    <>
      <div className="flex justify-between gap-8 my-6 ">
        <Link
          href={"/"}
          className="px-4 py-2.5 border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld text-primary-ld"
        >
          <Image
            src={"/images/svgs/google-icon.svg"}
            alt="google"
            height={18}
            width={18}
          />{" "}
          Google
        </Link>
        <Link
          href={"/"}
          className="px-4 py-2.5 border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld text-primary-ld"
        >
          <Image
            src={"/images/svgs/github-icon.svg"}
            alt="github"
            height={18}
            width={18}
            className="dark:hidden block"
          />
          <Image
            src={"/images/svgs/github-icon-white.svg"}
            alt="github"
            height={18}
            width={18}
            className="dark:block hidden"
          />
          Github
        </Link>
      </div>
      {/* Divider */}
      <div className="flex items-center justify-center gap-2">
        <hr className="grow border-ld" />
        <p className="text-base text-ld font-medium">{title}</p>
        <hr className="grow border-ld" />
      </div>
    </>
  );
};

export default SocialButtons;
