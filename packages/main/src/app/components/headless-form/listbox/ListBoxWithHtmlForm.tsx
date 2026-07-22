"use client";

import CardBox from "../../shared/CardBox";
import ListBoxWithHtml from "./codes/ListBoxWithHtmlCode";

const ListBoxWithHtmlForm = () => {
  return (
    <div>
      <CardBox>
        <h4 className="text-lg font-semibold mb-4">Using HTML forms</h4>
        <ListBoxWithHtml />
      </CardBox>
    </div>
  );
};

export default ListBoxWithHtmlForm;
