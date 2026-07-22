"use client";

import CardBox from "../../shared/CardBox";
import DisableListboxOption from "./codes/DisableListboxOptionCode";

const DisableListBox = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Listbox Option</h4>
        <DisableListboxOption />
      </CardBox>
    </div>
  );
};

export default DisableListBox;
