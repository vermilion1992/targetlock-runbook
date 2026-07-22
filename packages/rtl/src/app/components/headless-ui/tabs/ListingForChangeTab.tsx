"use client";

import CardBox from "../../shared/CardBox";
import ListingTabChange from "./code/ListingTabChangeCode";

const ListingForChangeTab = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Listening For Changes Tab
        </h4>
        <ListingTabChange />
      </CardBox>
    </div>
  );
};

export default ListingForChangeTab;
