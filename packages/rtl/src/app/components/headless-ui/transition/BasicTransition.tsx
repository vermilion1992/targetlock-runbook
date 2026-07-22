"use client";

import CardBox from "../../shared/CardBox";
import Basictransaction from "./codes/BasicTransactionCode";

const BasicTransition = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Basic Transition</h4>
        <Basictransaction />
      </CardBox>
    </div>
  );
};

export default BasicTransition;
