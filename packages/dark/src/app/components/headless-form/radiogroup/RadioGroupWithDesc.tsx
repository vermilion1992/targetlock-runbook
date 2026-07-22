"use client";

import CardBox from "../../shared/CardBox";
import RadioGroupWithdesc from "./codes/RadioGroupWithDescCode";

const RadioGroupWithDesc = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">With Description</h4>
        <RadioGroupWithdesc />
      </CardBox>
    </div>
  );
};

export default RadioGroupWithDesc;
