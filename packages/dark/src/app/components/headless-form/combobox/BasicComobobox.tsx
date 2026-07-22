"use client";

import CardBox from "../../shared/CardBox";
import BasicCombo from "./codes/BasicComboCode";

const BasicCombobox = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Basic</h4>
        <BasicCombo />
      </CardBox>
    </div>
  );
};

export default BasicCombobox;
