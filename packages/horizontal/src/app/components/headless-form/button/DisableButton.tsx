import CardBox from "../../shared/CardBox";
import DisableButtons from "./codes/DisableButtonsCode";

const DisableButton = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Buttons</h4>
        <DisableButtons />
      </CardBox>
    </div>
  );
};

export default DisableButton;
