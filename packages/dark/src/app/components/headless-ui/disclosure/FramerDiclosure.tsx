"use client";

import CardBox from "@/app/components/shared/CardBox";
import FramerMotion from "./code/FramerMotionCode";

const FramerDiclosure = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Disclosure With Framer Motion
        </h4>
        <FramerMotion />
      </CardBox>
    </div>
  );
};

export default FramerDiclosure;
