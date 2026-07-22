import CardBox from "../../shared/CardBox";
import Disableselect from "./code/DisableSelectCode";

const DisabledSelect = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disabeld Select</h4>
        <Disableselect />
      </CardBox>
    </div>
  );
};

export default DisabledSelect;
