"use client";

import CardBox from "../../shared/CardBox";
import ButtonAction from "./code/ButtonActionCode";

const ButtonDropdown = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Button Action</h4>
        <ButtonAction />
      </CardBox>
    </div>
  );
};

export default ButtonDropdown;
