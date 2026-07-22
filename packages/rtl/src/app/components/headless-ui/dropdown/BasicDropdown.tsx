"use client";

import CardBox from "../../shared/CardBox";
import Basicdropdown from "./code/BasicDropdownCode";

const BasicDropdown = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Basic Dropdown</h4>
        <Basicdropdown />
      </CardBox>
    </div>
  );
};

export default BasicDropdown;
