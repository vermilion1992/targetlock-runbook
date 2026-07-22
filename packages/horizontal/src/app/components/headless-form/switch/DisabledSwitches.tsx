"use client";

import CardBox from "../../shared/CardBox";
import DisableSwitch from "./codes/DisableSwitchesCode";

const DisabledSwitches = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disabled Switches</h4>
        <DisableSwitch />
      </CardBox>
    </div>
  );
};

export default DisabledSwitches;
