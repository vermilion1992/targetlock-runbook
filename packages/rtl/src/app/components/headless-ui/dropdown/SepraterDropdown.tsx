"use client";

import CardBox from "../../shared/CardBox";
import SepratingItems from "./code/SepratingItemsCode";

const SepratorDropdown = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Separating Items</h4>
        <SepratingItems />
      </CardBox>
    </div>
  );
};

export default SepratorDropdown;
