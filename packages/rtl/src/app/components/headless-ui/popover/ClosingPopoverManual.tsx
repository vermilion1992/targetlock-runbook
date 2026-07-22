"use client";

import CardBox from "../../shared/CardBox";
import ClosingManually from "./code/ClosingManuallyCode";

const ClosingPopoverManual = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Closing Popovers Manually
        </h4>
        <ClosingManually />
      </CardBox>
    </div>
  );
};

export default ClosingPopoverManual;
