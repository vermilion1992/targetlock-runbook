"use client";

import CardBox from "../../shared/CardBox";
import WithHtmlRadioForm from "./codes/WithHtmlRadioFormCode";

const WithHtmlForms = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">With HTML forms</h4>
        <WithHtmlRadioForm />
      </CardBox>
    </div>
  );
};

export default WithHtmlForms;
