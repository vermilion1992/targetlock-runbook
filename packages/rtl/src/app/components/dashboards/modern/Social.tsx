"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMotionValue } from "framer-motion";
import AnimatedTooltip from "@/app/components/animated-components/AnimatedTooltip";

type SocialUser = {
  key: string;
  img: string;
  name: string;
  designation: string;
};

const Social = () => {
  const x = useMotionValue(0);

  const SocialFigure: SocialUser[] = [
    {
      key: "user2",
      img: "/images/profile/user-2.jpg",
      name: "Maria Rodriguez",
      designation: "Cloud Architect",
    },
    {
      key: "user3",
      img: "/images/profile/user-3.jpg",
      name: "David Smith",
      designation: "Cybersecurity Analyst",
    },
    {
      key: "user4",
      img: "/images/profile/user-4.jpg",
      name: "Charles Martha",
      designation: "SEO Strategist",
    },
    {
      key: "user5",
      img: "/images/profile/user-5.jpg",
      name: "James Johnson",
      designation: "Blockchain Developer",
    },
  ];

  return (
    <Card>
      {/* Header Section */}
      <div className="flex items-center gap-6 mb-10 pb-2">
        <div className="shrink-0">
          <Image
            src={"/images/profile/user-1.jpg"}
            className="rounded-md shrink-0"
            alt="user-img"
            width={72}
            height={72}
          />
        </div>
        <div>
          <h5 className="card-title mb-2.5 leading-tight">Mathew Anderson</h5>
          <p className="card-subtitle">22 March, 2025</p>
        </div>
      </div>

      {/* Avatar List with Tooltip */}
      <div className="flex justify-between">
        <div className="flex">
          {SocialFigure.map((item, index) => (
            <div key={item.key} className="group relative -ml-3 first:ml-0">
              {/* Tooltip */}
              <AnimatedTooltip
                name={item.name}
                designation={item.designation}
                x={x}
              />
              {/* Image */}
              <Image
                onMouseMove={(e) =>
                  x.set(e.nativeEvent.offsetX - e.currentTarget.offsetWidth / 2)
                }
                src={item.img}
                alt={item.name}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full border-2 border-white object-cover transition duration-500 group-hover:z-30 group-hover:scale-105"
              />
            </div>
          ))}
        </div>

        {/* Icon */}
        <Button variant={"lightprimary"} asChild>
          <Link href="/apps/chats" className="text-xl">
            <Icon icon="tabler:message-2" />
          </Link>
        </Button>
      </div>
    </Card>
  );
};

export { Social };
