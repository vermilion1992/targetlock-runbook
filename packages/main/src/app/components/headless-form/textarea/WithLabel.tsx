import CardBox from "../../shared/CardBox";
import WithLabel from "./code/WithLabelCode";

const WithLabelTextarea = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Label With Textarea</h4>
        <WithLabel />
      </CardBox>
    </div>
  );
};

export default WithLabelTextarea;
