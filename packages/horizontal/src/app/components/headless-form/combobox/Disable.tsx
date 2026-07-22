"use client";

import CardBox from "../../shared/CardBox";
import Disabled from "./codes/DisabledCode";

const DisableCombo = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disabled</h4>
        <Disabled />
      </CardBox>
    </div>
  );
};

export default DisableCombo;
