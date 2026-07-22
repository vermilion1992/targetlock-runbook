import CardBox from "../../shared/CardBox";
import Withdescription from "./codes/WithDescriptionCode";

const WithDescription = () => {
  return (
    <div>
      <CardBox className="p-0">
        <h4 className="text-lg font-semibold mb-4">With Discription</h4>
        <Withdescription />
      </CardBox>
    </div>
  );
};

export default WithDescription;
