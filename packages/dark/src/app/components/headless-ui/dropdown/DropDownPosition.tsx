"use client";

import CardBox from "../../shared/CardBox";
import Dropdownposition from "./code/DropdownPositionCode";

const DropDownPosition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Position</h4>
        <Dropdownposition />
      </CardBox>
    </div>
  );
};

export default DropDownPosition;
