import CardBox from "../../shared/CardBox";
import Fieldset from "./codes/FieldsetCode";

const MainFieldset = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Fieldset Form</h4>
        <Fieldset />
      </CardBox>
    </div>
  );
};

export default MainFieldset;
