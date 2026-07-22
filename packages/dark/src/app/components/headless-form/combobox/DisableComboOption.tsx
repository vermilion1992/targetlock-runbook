"use client";

import CardBox from "../../shared/CardBox";
import DisableComboOpt from "./codes/DisableComboOptCode";

const DisableComboOption = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disabled Combo Option</h4>
        <DisableComboOpt />
      </CardBox>
    </div>
  );
};

export default DisableComboOption;
