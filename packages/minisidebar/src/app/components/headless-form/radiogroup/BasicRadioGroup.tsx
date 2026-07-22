"use client";

import CardBox from "../../shared/CardBox";
import BasicRadiogroup from "./codes/BasicRadioGroupCode";

const BasicRadioGroup = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Styling Radio Group</h4>
        <BasicRadiogroup />
      </CardBox>
    </div>
  );
};

export default BasicRadioGroup;
