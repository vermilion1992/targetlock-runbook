import CardBox from "../../shared/CardBox";
import DisableTextArea from "./code/DisableTextAreaCode";

const DisableTextarea = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold">Disabled Textarea</h4>
        <DisableTextArea />
      </CardBox>
    </div>
  );
};

export default DisableTextarea;
