"use client";

import CardBox from "../../shared/CardBox";
import LinkDropDown from "./code/LinkDropdownCode";

const LinkDropdown = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Links Dropdown</h4>
        <LinkDropDown />
      </CardBox>
    </div>
  );
};

export default LinkDropdown;
