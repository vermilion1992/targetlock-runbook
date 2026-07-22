"use client";

import CardBox from "../../shared/CardBox";
import WithLabelswitch from "./codes/WithLabelSwitchCode";

const WithLabelSwitch = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Adding a Label</h4>
        <WithLabelswitch />
      </CardBox>
    </div>
  );
};

export default WithLabelSwitch;
