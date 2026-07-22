import CardBox from "../../shared/CardBox";
import DisableCheck from "./codes/DisableCheckCode";

const DisableCheckBox = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Checkbox</h4>
        <DisableCheck />
      </CardBox>
    </div>
  );
};

export default DisableCheckBox;
