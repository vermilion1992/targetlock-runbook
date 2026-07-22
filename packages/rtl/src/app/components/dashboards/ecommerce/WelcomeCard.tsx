"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react/dist/iconify.js";
import Lottie from "lottie-react";
import onlinedoctor from "@/../public/animation/onlinedoctor.json";
import { useEffect, useState } from "react";
import CountUp from "../../animated-components/CountUp";

// Typing animation component
function TypingAnimationMotion() {
  const words = ["back Mathew!", "to your dashboard!"];
  const [i, setI] = useState(0);
  const [j, setJ] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const currentWord = words[i];

    const timeout = setTimeout(() => {
      if (isDeleting) {
        setText(currentWord.substring(0, j - 1));
        setJ(j - 1);

        if (j === 0) {
          setIsDeleting(false);
          setI((prev) => (prev + 1) % words.length);
        }
      } else {
        setText(currentWord.substring(0, j + 1));
        setJ(j + 1);

        if (j === currentWord.length) {
          setIsDeleting(true);
        }
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [j, i, isDeleting, words]);

  return <h5 className="text-lg lg:whitespace-nowrap">Welcome {text}</h5>;
}

export const WelcomeCard = () => {
  return (
    <Card className="bg-lightprimary dark:bg-lightprimary overflow-hidden shadow-none relative h-full">
      <div className="grid grid-cols-12 h-full">
        <div className="md:col-span-7 col-span-12 content-center">
          <div className="flex flex-col gap-8">
            <div className="flex gap-3 items-center">
              <div className="rounded-full overflow-hidden">
                <Image
                  src={"/images/profile/user-1.jpg"}
                  width={40}
                  height={40}
                  className="rounded-full"
                  alt="Profile picture of Mathew"
                />
              </div>
              {/* Use Typing Animation here */}
              <TypingAnimationMotion />
            </div>
            <div className="flex gap-6 items-center">
              <div className="pe-6 rtl:pe-auto rtl:ps-6 border-e border-border border-opacity-20 dark:border-darkborder">
                <h3 className="flex items-start mb-0 text-3xl">
                  <span>
                    $<CountUp to={2340} />
                  </span>
                  <Icon
                    icon="tabler:arrow-up-right"
                    className="text-base text-success"
                  />
                </h3>
                <p className="text-sm mt-1">Today’s Sales</p>
              </div>
              <div>
                <h3 className="flex items-start mb-0 text-3xl">
                  <span>
                    <CountUp to={35} />%
                  </span>
                  <Icon
                    icon="tabler:arrow-up-right"
                    className="text-base text-success"
                  />
                </h3>
                <p className="text-sm mt-1">Overall Performance</p>
              </div>
            </div>
          </div>
        </div>
        <div className="md:col-span-5 md:block hidden relative">
          <div className="absolute right-5 -bottom-10">
            <Lottie animationData={onlinedoctor} loop={true} />
          </div>
        </div>
      </div>
    </Card>
  );
};
