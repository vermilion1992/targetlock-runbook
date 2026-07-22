import React from "react";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
const MutualBanner = () => {
  return (
    <>
      <Card className="mt-[30px] text-center">
        <h5 className="text-lg mb-4">Mutual Friend Revealed</h5>
        <div className="relative w-auto mx-auto">
          <Image
            src={'/images/profile/user-3.jpg'}
            alt="banner"
            width={140}
            height={140}
            className="mx-auto  w-[140px] rounded-full"
          />
          <span className="rounded-full absolute end-3 top-[5px] bg-error text-[10px] h-5 w-5 flex justify-center items-center text-white">
            1
          </span>
        </div>

        <div className="mx-auto mt-4">
          <h5 className="text-lg">Tommoie Henderson</h5>
          <p className="text-darklink mt-2 md:px-12">
            Accept the request and type a message
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <Button>Accept</Button>
            <Button variant={"lighterror"}>Remove</Button>
          </div>
        </div>
      </Card>
    </>
  );
};

export default MutualBanner;
