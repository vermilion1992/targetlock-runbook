"use client";

import React, { useContext } from "react";
import Image from "next/image";
import AuthContext from "@/app/context/auth-context";

interface MyAppProps {
  title?: string;
}

const SocialButtons: React.FC<MyAppProps> = ({ title }) => {
  const { loginWithProvider } = useContext(AuthContext);

  const handleGoogle = async () => {
    try {
      await loginWithProvider("google");
    } catch (error) {
      console.error("Google login failed", error);
    }
  };

  const handleGithub = async () => {
    try {
      await loginWithProvider("github");
    } catch (error) {
      console.error("GitHub login failed", error);
    }
  };

  return (
    <>
      <div className="flex justify-between gap-8 my-6 ">
        <button
          onClick={handleGoogle}
          className="px-4 py-2.5 border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld text-primary-ld"
        >
          <Image
            src={"/images/svgs/google-icon.svg"}
            alt="google"
            height={18}
            width={18}
          />{" "}
          Google
        </button>
        <button
          onClick={handleGithub}
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
        </button>
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
