"use client";

import CardBox from "../../shared/CardBox";
import Transition from "./code/TransitionCode";

const TransitionDisclosure = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Transitions Disclosure</h4>
        <Transition />
      </CardBox>
    </div>
  );
};

export default TransitionDisclosure;
