"use client";
import { CustomizerContext } from "@/app/context/customizer-context";
import React, { useContext } from "react";
import { Icon } from "@iconify/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TitleCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: string;
  onDownload?: () => void;
}

const TitleIconCard: React.FC<TitleCardProps> = ({
  children,
  className,
  title,
  onDownload,
}) => {
  const { activeMode, isCardShadow, isBorderRadius } =
    useContext(CustomizerContext);

  return (
    <Card
      className={`card no-inset no-ring ${className} ${
        isCardShadow
          ? "dark:shadow-dark-md shadow-md p-0"
          : "shadow-none border border-ld p-0"
      }`}
      style={{
        borderRadius: `${isBorderRadius}px`,
      }}
    >
      <div className="flex justify-between items-center border-b border-ld px-6 py-4">
        <h5 className="text-xl font-semibold">{title}</h5>

        <Button className="flex items-center" onClick={onDownload}>
          <Icon icon="tabler:download" width={20} height={20} />
        </Button>
      </div>
      <div className="pt-4 p-6">{children}</div>
    </Card>
  );
};

export default TitleIconCard;
