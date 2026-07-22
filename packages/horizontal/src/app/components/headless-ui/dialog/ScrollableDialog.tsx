"use client";

import CardBox from "../../shared/CardBox";
import Scrollabledialog from "./code/ScrollableDialogCode";

const ScrollableDialog = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Scrollable Dialog</h4>
        <Scrollabledialog />
      </CardBox>
    </div>
  );
};

export default ScrollableDialog;
