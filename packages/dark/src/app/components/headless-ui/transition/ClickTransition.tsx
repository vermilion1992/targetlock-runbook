"use client";

import CardBox from "../../shared/CardBox";
import Clicktransition from "./codes/ClickTransitionCode";

const ClickTransition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Click To Transition</h4>
        <Clicktransition />
      </CardBox>
    </div>
  );
};
export default ClickTransition;
