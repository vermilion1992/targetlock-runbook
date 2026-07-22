"use client";

import CardBox from "../../shared/CardBox";
import DefaultOn from "./codes/DefaultOnSwitchCode";

const DEfaultOnSwitches = () => {
  return (
    <div>
      <CardBox className="p-0">
        <h4 className="text-lg font-semibold mb-4">Default On Switches</h4>
        <DefaultOn />
      </CardBox>
    </div>
  );
};

export default DEfaultOnSwitches;
