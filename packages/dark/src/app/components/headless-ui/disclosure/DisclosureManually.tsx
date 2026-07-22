"use client";

import CardBox from "../../shared/CardBox";
import ClosingDisclosure from "./code/ClosingDisclosureCode";

const DisclosureManually = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Closing Disclosures Manually
        </h4>
        <ClosingDisclosure />
      </CardBox>
    </div>
  );
};

export default DisclosureManually;
