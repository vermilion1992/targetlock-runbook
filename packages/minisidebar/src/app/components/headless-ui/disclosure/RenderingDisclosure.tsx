"use client";

import CardBox from "../../shared/CardBox";
import RenderDiclosure from "./code/RenderDiclosureCode";

const RenderingDisclosure = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Rendering As Different Elements
        </h4>
        <RenderDiclosure />
      </CardBox>
    </div>
  );
};

export default RenderingDisclosure;
