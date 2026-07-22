"use client";

import CardBox from "../../shared/CardBox";
import LabelWithList from "./codes/LabelWithListcode";

const LabelListbox = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Label With Listbox</h4>
        <LabelWithList />
      </CardBox>
    </div>
  );
};

export default LabelListbox;
