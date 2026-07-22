"use client";

import CardBox from "../../shared/CardBox";
import IntialTransition from "./codes/IntialTransitionCode";

const OnIntialAmmount = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Transitioning On Initial Mount
        </h4>
        <IntialTransition />
      </CardBox>
    </div>
  );
};

export default OnIntialAmmount;
