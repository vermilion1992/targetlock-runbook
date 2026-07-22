"use client";

import CardBox from "../../shared/CardBox";
import DisableItem from "./code/DisableItemCode";

const DisablingItem = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Items</h4>
        <DisableItem />
      </CardBox>
    </div>
  );
};

export default DisablingItem;
