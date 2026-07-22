"use client";
import React from "react";
import Notelist from "./NotesList";

const NotesSidebar = () => {
  return (
    <>
      <div className="left-part">
        <Notelist />
      </div>
    </>
  );
};

export default NotesSidebar;
