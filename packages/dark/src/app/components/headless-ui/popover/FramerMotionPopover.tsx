"use client";

import CardBox from "../../shared/CardBox";
import FramerPopover from "./code/FramerPopoverCode";

const FramerMotionPopover = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Framer Motion Popover</h4>
        <FramerPopover />
      </CardBox>
    </div>
  );
};

export default FramerMotionPopover;
