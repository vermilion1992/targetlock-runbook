"use client";

import { useState, useContext } from "react";
import { CustomizerContext } from "@/app/context/customizer-context";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import SimpleBar from "simplebar-react";
import { Icon } from "@iconify/react/dist/iconify.js";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface AnimatedCodeWrapperProps {
  children: string; // TSX/JSX code
  css?: string; // optional CSS
  showReplayButton?: boolean;
  onReplay?: () => void;
}

const AnimatedCodeWrapper = ({
  children,
  css = "",
  showReplayButton = false,
  onReplay,
}: AnimatedCodeWrapperProps) => {
  const { isBorderRadius } = useContext(CustomizerContext);

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("tsx");

  const handleCopy = () => {
    const code = tab === "tsx" ? children : css;

    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div
      className="px-6 py-2 bg-gray-100 dark:bg-white/2 border-t border-border dark:border-darkborder"
      style={{
        borderBottomLeftRadius: `${isBorderRadius}px`,
        borderBottomRightRadius: `${isBorderRadius}px`,
      }}
    >
      {/* Top controls */}
      <div
        className={`flex items-center ${
          showReplayButton ? "justify-between" : "justify-end"
        }`}
      >
        {/* Replay button */}
        {showReplayButton && (
          <button
            onClick={onReplay}
            className="text-xs py-1 px-2 rounded-full border border-dark/15 dark:border-white/20 hover:border-lightprimary hover:bg-lightprimary flex items-center gap-1"
          >
            <Icon
              icon="material-symbols:replay-rounded"
              width={14}
              height={14}
            />
            Replay Animation
          </button>
        )}

        <TooltipProvider>
          <div className="flex items-center gap-2">
            {/* Show / Hide */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-xs py-1 px-1.5 rounded-full border border-dark/15 dark:border-white/20 hover:border-lightprimary hover:bg-lightprimary"
            >
              {isOpen ? "Hide Code" : "Show Code"}
            </button>

            {/* Copy */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleCopy} className="p-2">
                  {copied ? (
                    <Icon
                      icon="charm:tick"
                      width={20}
                      height={20}
                      className="text-primary"
                    />
                  ) : (
                    <Icon
                      icon="qlementine-icons:copy-16"
                      width={20}
                      height={20}
                      className="hover:text-primary"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="whitespace-nowrap">
                Copy Code
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Code Wrapper */}
      <div
        className={`code-modal rounded-md rounded-t-none p-0 my-3 bg-gray-100 dark:bg-transparent overflow-hidden ${
          isOpen ? "block" : "hidden"
        }`}
      >
        <Tabs defaultValue="tsx" onValueChange={setTab}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-base font-semibold dark:text-white">
              Component Code
            </h5>

            {/* Tabs header */}
            <TabsList className="px-3 pt-2">
              <TabsTrigger
                value="tsx"
                className="rounded-full text-xs px-3 py-1.5"
              >
                TSX
              </TabsTrigger>

              {css && (
                <TabsTrigger
                  value="css"
                  className="rounded-full text-xs px-3 py-1.5"
                >
                  CSS
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* TSX TAB */}
          <TabsContent value="tsx">
            <SimpleBar className="max-h-[400px]">
              <SyntaxHighlighter language="tsx" style={vscDarkPlus}>
                {children}
              </SyntaxHighlighter>
            </SimpleBar>
          </TabsContent>

          {/* CSS TAB */}
          <TabsContent value="css">
            <SimpleBar className="max-h-[400px]">
              <SyntaxHighlighter language="css" style={vscDarkPlus}>
                {css}
              </SyntaxHighlighter>
            </SimpleBar>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnimatedCodeWrapper;
