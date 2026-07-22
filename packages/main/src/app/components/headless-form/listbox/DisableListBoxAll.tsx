"use client";

import CardBox from "../../shared/CardBox";
import DisableListbox from "./codes/DisableListboxCode";

const DisableListAll = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Listbox</h4>
        <DisableListbox />
      </CardBox>
    </div>
  );
};

export default DisableListAll;
