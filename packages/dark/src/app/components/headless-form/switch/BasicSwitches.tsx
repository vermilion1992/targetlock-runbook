"use client";

import CardBox from "../../shared/CardBox";
import BasicSwitch from "./codes/BasicSwitchCode";

const BasicSwitches = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Basic Switches</h4>
        <BasicSwitch />
      </CardBox>
    </div>
  );
};

export default BasicSwitches;
