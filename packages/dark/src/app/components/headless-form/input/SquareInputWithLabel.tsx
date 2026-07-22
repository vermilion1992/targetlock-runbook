import CardBox from "../../shared/CardBox";
import SquareInputWithLbl from "./codes/SquareInputCode";

const SquareInputWithLabel = () => {
  return (
    <div>
      <CardBox className="p-0">
        <h4 className="text-lg font-semibold mb-4">Square Input With Label</h4>
        <SquareInputWithLbl />
      </CardBox>
    </div>
  );
};

export default SquareInputWithLabel;
