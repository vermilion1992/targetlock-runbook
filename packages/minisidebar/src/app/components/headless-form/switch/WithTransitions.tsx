"use client";

import CardBox from "../../shared/CardBox";
import WithTransition from "./codes/WithTransitionCode";

const WithTransitionsSwitch = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Adding Transitions</h4>
        <WithTransition />
      </CardBox>
    </div>
  );
};

export default WithTransitionsSwitch;
