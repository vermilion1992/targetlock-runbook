"use client";

import CardBox from "../../shared/CardBox";
import ListDesc from "./codes/ListDescCode";

const ListboxWithDescription = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Listbox With Description</h4>
        <ListDesc />
      </CardBox>
    </div>
  );
};

export default ListboxWithDescription;
