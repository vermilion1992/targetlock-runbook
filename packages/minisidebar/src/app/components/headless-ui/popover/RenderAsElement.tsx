"use client";

import CardBox from "../../shared/CardBox";
import RenderPopover from "./code/RenderPopoverCode";

const RenderAsElement = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Rendering Different Elements
        </h4>
        <RenderPopover />
      </CardBox>
    </div>
  );
};

export default RenderAsElement;
