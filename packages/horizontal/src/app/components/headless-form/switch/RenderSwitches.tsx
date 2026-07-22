"use client";

import CardBox from "../../shared/CardBox";
import RenderAsElements from "./codes/RenderAsElements";

const RenderSwitches = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Rendering as Element</h4>
        <RenderAsElements />
      </CardBox>
    </div>
  );
};

export default RenderSwitches;
