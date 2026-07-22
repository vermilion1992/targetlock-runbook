"use client";

import CardBox from "../../shared/CardBox";
import Coordination from "./codes/CoordinationCode";

const CoordinationTransition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Coordinating Transition</h4>
        <Coordination />
      </CardBox>
    </div>
  );
};

export default CoordinationTransition;
