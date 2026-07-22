"use client";

import CardBox from "../../shared/CardBox";
import Comboposition from "./codes/ComboPositionCode";

const ComboPosition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Dropdown Position</h4>
        <Comboposition />
      </CardBox>
    </div>
  );
};

export default ComboPosition;
