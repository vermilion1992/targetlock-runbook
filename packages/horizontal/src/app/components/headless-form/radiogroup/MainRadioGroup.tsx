"use client";

import CardBox from "../../shared/CardBox";
import MainRadiogroup from "./codes/MainRadioGroupCode";

const MainRadioGroup = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Simple Radio Group </h4>
        <MainRadiogroup />
      </CardBox>
    </div>
  );
};

export default MainRadioGroup;
