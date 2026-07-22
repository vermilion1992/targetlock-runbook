"use client";
import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react";
/*--Profile Cards--*/
const profilecards = [
  {
    title: "Andrew Grant",
    subtitle: "Sint Maarten",
    avatar: '/images/profile/user-6.jpg',
  },
  {
    title: "Leo Pratt",
    subtitle: "Bulgaria",
    avatar: '/images/profile/user-2.jpg',
  },
  {
    title: "Charles Nunez",
    subtitle: "Nepal",
    avatar: '/images/profile/user-3.jpg',
  },
];

const ProfileCards = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        {profilecards.map((item, i) => (
          <div className="lg:col-span-4 col-span-12" key={i}>
            <Card>
              <div className="flex items-center">
                <Image
                  src={item.avatar}
                  alt="materialm"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
                <div className="ms-3">
                  <h5 className="text-lg">{item.title}</h5>
                  <p className="text-xs text-darklink flex gap-1 items-center"><Icon icon="tabler:map-pin" height={15}/> {item.subtitle}</p>
                </div>
                <Button className="w-fit ms-auto">
                  Follow
                </Button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
};

export default ProfileCards;
