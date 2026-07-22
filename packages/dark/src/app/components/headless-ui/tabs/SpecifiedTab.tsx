import CardBox from "../../shared/CardBox";
import SpecifiedDefault from "./code/SpecifiedDefaultCode";

const SpecifiedTab = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">
          Specifying The Default Tab
        </h4>
        <SpecifiedDefault />
      </CardBox>
    </div>
  );
};

export default SpecifiedTab;
