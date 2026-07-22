import CardBox from "../../shared/CardBox";
import WithLabelselect from "./code/WithLabelSelectCode";

const WithLabelSelect = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">With Label Select</h4>
        <WithLabelselect />
      </CardBox>
    </div>
  );
};

export default WithLabelSelect;
