"use client";

import { CustomizerContext } from "@/app/context/customizer-context";

import { Card } from "@/components/ui/card";
import React, { useContext } from "react";

interface MyAppProps {
  children: React.ReactNode;
  className?: string;
}
const CardBox: React.FC<MyAppProps> = ({ children, className }) => {
  const { activeMode, isCardShadow, isBorderRadius } =
    useContext(CustomizerContext);
  return (
    <Card
      className={`card no-inset no-ring ${className} ${
        isCardShadow
          ? "dark:shadow-dark-md shadow-md !border-none dark:!border-none"
          : "shadow-none border border-ld"
      } `}
      style={{
        borderRadius: `${isBorderRadius}px`,
      }}
    >
      {children}
    </Card>
  );
};

export default CardBox;
