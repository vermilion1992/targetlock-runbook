"use client";

import CardBox from "../../shared/CardBox";
import GroupItem from "./code/GroupItemCode";

const GroupingItems = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Grouping Items</h4>
        <GroupItem />
      </CardBox>
    </div>
  );
};

export default GroupingItems;
