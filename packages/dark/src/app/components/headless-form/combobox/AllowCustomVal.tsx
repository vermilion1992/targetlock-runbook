"use client";

import CardBox from "../../shared/CardBox";
import HtmlForms from "./codes/HtmlFormsCodes";

const AllowCustomVal = () => {
  return (
    <div>
      <CardBox className="p-0">
        <div>
          <div className="p-6">
            <h4 className="text-lg font-semibold mb-4">HTML Forms</h4>
            <HtmlForms />
          </div>
        </div>
      </CardBox>
    </div>
  );
};

export default AllowCustomVal;
