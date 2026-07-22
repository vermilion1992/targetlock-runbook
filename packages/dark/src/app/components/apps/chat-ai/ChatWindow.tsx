import React, { useContext, useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { AvatarFallback, AvatarImage, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { ChatAIContext } from "@/app/context/aichat-context";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { marked } from "marked";
import DOMPurify from "dompurify";
import SimpleBar from "simplebar-react";
import { CustomizerContext } from "@/app/context/customizer-context";
import { toast, ToastContainer } from "react-toastify";
import Image from "next/image";
import { ChatAIMessage } from "@/app/(DashboardLayout)/types/apps/ai-chat";

function ChatWindow({
  onClickMobile,
}: {
  onClickMobile: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const { activeMode } = useContext(CustomizerContext)!;
  const { chatList, typing } = useContext(ChatAIContext)!;

  const [copiedMsgId, setCopiedMsgId] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<"upvote" | "downvote" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, msgId: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(String(msgId));
    setFeedback("Copied to clipboard!");
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleVote = (type: "upvote" | "downvote") => {
    setUserVote(type);
    setFeedback(type === "upvote" ? "Upvoted response" : "Downvoted response");
    setTimeout(() => setFeedback(null), 2000);
  };

  //markdown
  const renderMarkdownToHtml = (markdown: string): string => {
    const rawHtml = marked.parse(markdown) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return cleanHtml;
  };

  // react toastify setup.
  const toastColor = activeMode === "dark" ? "dark" : "light";
  useEffect(() => {
    if (feedback) {
      toast(feedback, {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: toastColor,
      });
    }
  }, [feedback]);

  return (
    <>
      <SimpleBar className="flex-1 min-h-0">
        <div className="p-6">
          <div className="lg:hidden flex">
            <Button
              variant={"lightprimary"}
              shape={"pill"}
              onClick={onClickMobile}
            >
              <Icon icon="solar:hamburger-menu-outline" height={18} />
            </Button>
          </div>
          {chatList.map((msg: ChatAIMessage, index: number) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id ?? index}
                className={`flex ${
                  isUser ? "justify-end my-3" : "justify-start"
                } items-start gap-3`}
              >
                {!isUser && (
                  <div className="rounded-full p-2 text-white bg-primary">
                    <Icon
                      icon={"solar:stars-minimalistic-linear"}
                      width={24}
                      height={24}
                    />
                  </div>
                )}

                <div
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  } w-full gap-3`}
                >
                  {msg.text.split(/```/g).map((block: string, idx: number) => {
                    const isCode = idx % 2 === 1;

                    const [langLine, ...codeLines] = block.split("\n");
                    const language =
                      isCode && langLine.match(/^[a-zA-Z]+$/)
                        ? langLine
                        : "plaintext";
                    const code =
                      language !== "plaintext" ? codeLines.join("\n") : block;

                    if (isCode) {
                      return (
                        <div
                          key={idx}
                          className="bg-gray-100 dark:bg-white/10 p-3 rounded-md w-full overflow-auto truncate"
                        >
                          <SyntaxHighlighter
                            language={language}
                            style={vscDarkPlus}
                          >
                            {code}
                          </SyntaxHighlighter>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-md ${
                            isUser
                              ? "bg-gray-200 dark:bg-gray-700"
                              : "bg-gray-100 dark:bg-gray-700"
                          } max-w-full`}
                        >
                          <div
                            className="text-sm text-gray-900 dark:text-white"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownToHtml(block.trim()),
                            }}
                          />
                          {msg.imageUrl && (
                            <Image
                              src={msg.imageUrl}
                              alt="uploaded"
                              className="max-w-[200px] mt-2"
                              width={100}
                              height={100}
                            />
                          )}
                        </div>
                      );
                    }
                  })}
                  <TooltipProvider>
                    {/* Copy / Vote Buttons */}
                    {!isUser && (
                      <div className="flex items-center gap-2 mt-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleCopy(msg.text, msg.id)}
                              className="p-1 rounded-full hover:cursor-pointer hover:bg-lightprimary dark:hover:bg-darkprimary"
                            >
                              {copiedMsgId === String(msg.id) ? (
                                <Icon
                                  icon="solar:check-read-line-duotone"
                                  width={20}
                                  height={20}
                                />
                              ) : (
                                <Icon
                                  icon="solar:copy-line-duotone"
                                  width={20}
                                  height={20}
                                />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Copy</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleVote("upvote")}
                              className="p-1 rounded-full hover:cursor-pointer hover:bg-lightprimary dark:hover:bg-darkprimary"
                            >
                              <Icon
                                icon="material-symbols-light:thumb-up-outline"
                                width={24}
                                height={24}
                                className={
                                  userVote === "upvote"
                                    ? "text-primary"
                                    : "text-gray-500"
                                }
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Good response</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleVote("downvote")}
                              className="p-1 rounded-full hover:cursor-pointer hover:bg-lightprimary dark:hover:bg-darkprimary"
                            >
                              <Icon
                                icon="material-symbols-light:thumb-down-outline-sharp"
                                width={24}
                                height={24}
                                className={
                                  userVote === "downvote"
                                    ? "text-error"
                                    : "text-gray-500"
                                }
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Bad response</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TooltipProvider>
                </div>

                {isUser && (
                  <Avatar>
                    <AvatarImage src="/images/profile/user-1.jpg" alt="User" />
                    <AvatarFallback>User</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          {/* Typing Indicator */}
          {typing && (
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 text-white bg-primary">
                <Icon
                  icon={"solar:stars-minimalistic-linear"}
                  width={24}
                  height={24}
                />
              </div>
              <div className="animate-pulse space-x-1">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
              </div>
            </div>
          )}
        </div>
        <div ref={scrollRef} />
      </SimpleBar>
      {feedback && <ToastContainer />}
    </>
  );
}

export default ChatWindow;
