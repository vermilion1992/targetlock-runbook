"use client";

import CardBox from "../../shared/CardBox";
import ComboWithLable from "./codes/ComboWithLableCode";

const WithLabel = () => {
  return (
    <div>
      <CardBox className="p-0">
        <h4 className="text-lg font-semibold mb-4">With Label</h4>
        <ComboWithLable />
      </CardBox>
    </div>
  );
};

export default WithLabel;
