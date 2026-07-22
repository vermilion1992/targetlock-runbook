import CardBox from "../../shared/CardBox";
import DisableOutlineBtn from "./codes/DisableOutlineBtnCode";

const DisableOutlineButtons = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Disable Outlined Buttons</h4>
        <DisableOutlineBtn />
      </CardBox>
    </div>
  );
};

export default DisableOutlineButtons;
