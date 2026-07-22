"use client";
import { CustomizerContext } from "@/app/context/customizer-context";

import { Card } from "@/components/ui/card";
import React, { useContext } from "react";

interface MyAppProps {
  children: React.ReactNode;
  className?: string;
}
const OutlineCard: React.FC<MyAppProps> = ({ children, className }) => {
  const { isCardShadow } = useContext(CustomizerContext);
  return (
    <Card
      className={`card no-inset no-ring ${className} ${
        isCardShadow ? "shadow-none border border-ld" : " border border-ld"
      } `}
    >
      {children}
    </Card>
  );
};

export default OutlineCard;
