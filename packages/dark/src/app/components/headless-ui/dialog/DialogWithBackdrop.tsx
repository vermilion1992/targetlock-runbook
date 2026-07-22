"use client";

import CardBox from "../../shared/CardBox";
import WithBackdrop from "./code/WithBackdropCode";

const DialogWithBackdrop = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Dialog With Backdrop</h4>
        <WithBackdrop />
      </CardBox>
    </div>
  );
};

export default DialogWithBackdrop;
