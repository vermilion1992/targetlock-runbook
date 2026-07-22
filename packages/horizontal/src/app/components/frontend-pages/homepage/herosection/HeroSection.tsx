"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { useMotionValue } from "framer-motion";
import AnimatedTooltip from "@/app/components/animated-components/AnimatedTooltip";

export const HeroSection = () => {
  const x = useMotionValue(0);
  const TechnStacks = [
    {
      key: "tech1",
      img: "/images/frontend-pages/technology/Categories=React.svg",
      title: "React",
    },

    {
      key: "tech3",
      img: "/images/frontend-pages/technology/Categories=Nextjs.svg",
      title: "NextJS",
    },
    {
      key: "tech4",
      img: "/images/frontend-pages/technology/Typescript.svg",
      title: "Typescript",
    },
    {
      key: "tech5",
      img: "/images/frontend-pages/technology/Categories=Tailwind.svg",
      title: "Tailwind",
    },
    {
      key: "tech6",
      img: "/images/frontend-pages/technology/shadcn-icon.svg",
      title: "Shadcn",
    },
  ];
  const [openModal, setOpenModal] = useState(false);
  return (
    <section>
      <div className="lg:pt-6 pt-0 bg-lightprimary">
        <div className="container py-4 pb-0 px-4">
          <div className="flex w-full justify-center">
            <div className="md:w-8/12 w-full pt-8">
              <h1 className="lg:text-56 text-4xl leading-tight text-center font-bold text-link dark:text-white">
                Most powerful &{" "}
                <span className="text-primary">Developer friendly</span> Admin
                dashboard
              </h1>
            </div>
          </div>
          <div className="w-full pt-5">
            <div className="flex flex-wrap gap-6 items-center justify-center mx-auto mb-3">
              <div className="flex">
                <Image
                  src="/images/profile/user-1.jpg"
                  alt="user-image"
                  width={40}
                  height={40}
                  className="w-10 h-10  rounded-full border-2 border-white relative -mr-2.5 z-[2]"
                />
                <Image
                  src="/images/profile/user-2.jpg"
                  alt="user-image"
                  width={40}
                  height={40}
                  className="w-10 h-10  rounded-full border-2 border-white relative -mr-2.5 z-[1]"
                />
                <Image
                  src="/images/profile/user-3.jpg"
                  alt="user-image"
                  width={40}
                  height={40}
                  className="w-10 h-10  rounded-full border-2 border-white"
                />
              </div>
              <div className="text-lg text-bodytext dark:text-darklink font-medium text-center">
                52,589+ developers & agencies using our templates
              </div>
            </div>
            <div className="w-full relative p-3 img-wrapper">
              <div className="flex items-center justify-center gap-5 mx-auto">
                <Button
                  asChild
                  color={"primary"}
                  className="text-sm font-medium"
                >
                  <Link href="/auth/auth1/login">Login</Link>
                </Button>
                <div
                  onClick={() => setOpenModal(true)}
                  className="flex items-center gap-3 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full flex items-center text-primary group-hover:bg-primary group-hover:text-white justify-center border-2 border-primary">
                    <Icon
                      icon="tabler:player-play-filled"
                      className=" text-base"
                    />
                  </div>
                  <p className="text-link group-hover:text-primary dark:text-darklink font-medium text-[15px]">
                    See how it works
                  </p>
                </div>
              </div>
              <div className="py-9 flex justify-center item-center gap-6 flex-wrap">
                {TechnStacks.map((item) => {
                  return (
                    <div
                      onMouseMove={(e) =>
                        x.set(
                          e.nativeEvent.offsetX -
                            e.currentTarget.offsetWidth / 2
                        )
                      }
                      key={item.key}
                      className="h-14 w-14 rounded-[16px] custom-shadow bg-white dark:bg-darkgray flex items-center justify-center cursor-pointer group relative"
                    >
                      <Image
                        src={item.img}
                        alt="tech-icon"
                        width={30}
                        height={30}
                      />
                      <AnimatedTooltip name={item.title} x={x} />
                    </div>
                  );
                })}
              </div>
              <div>
                <Image
                  src="/images/frontend-pages/background/banner-left-widget.jpg"
                  alt="widget"
                  width={360}
                  height={200}
                  className="absolute top-0 start-0 rounded-2xl custom-shadow animated-img xl:block hidden dark:hidden"
                />
                <Image
                  src="/images/frontend-pages/background/banner-left-widget-dark.png"
                  alt="widget"
                  width={360}
                  height={200}
                  className="absolute top-0 start-0 rounded-2xl custom-shadow animated-img xl:dark:block hidden"
                />
              </div>
              <div>
                <Image
                  src="/images/frontend-pages/background/banner-right-widget.jpg"
                  alt="widget"
                  width={360}
                  height={200}
                  className="absolute -top-7 end-0 rounded-2xl custom-shadow animated-img xl:block hidden dark:hidden"
                />
                <Image
                  src="/images/frontend-pages/background/banner-right-widget-dark.png"
                  alt="widget"
                  width={360}
                  height={200}
                  className="absolute -top-7 end-0 rounded-2xl custom-shadow animated-img xl:dark:block hidden"
                />
              </div>
            </div>
            <div className="mt-4">
              <div>
                <Image
                  src="/images/frontend-pages/background/banner-bottom.png"
                  alt="banner-img"
                  width={1378}
                  height={306}
                  className="rounded-2xl dark:hidden"
                />
                <Image
                  src="/images/frontend-pages/background/banner-bottom-dark.png"
                  alt="banner-img"
                  width={1378}
                  height={306}
                  className="rounded-2xl dark:block hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="p-0 max-w-3xl">
          <DialogHeader className="hidden" />
          <iframe
            className="w-full h-96 rounded-md"
            src="https://www.youtube.com/embed/57QrNWhnbxg"
            title="How to Get Started with our NextJs Dashboard Template? | AdminMart&#39;s NextJsTemplate"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </DialogContent>
      </Dialog>
    </section>
  );
};
