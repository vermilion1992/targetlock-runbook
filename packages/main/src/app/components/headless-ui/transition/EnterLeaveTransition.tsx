"use client";

import CardBox from "../../shared/CardBox";
import EnterLeavetransition from "./codes/EnterLeaveTransitionCode";

const EnterLeaveTransition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Different Transition</h4>
        <EnterLeavetransition />
      </CardBox>
    </div>
  );
};

export default EnterLeaveTransition;
