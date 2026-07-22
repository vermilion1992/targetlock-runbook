"use client";

import { useContext, useState } from "react";
import { Card } from "@/components/ui/card";
import ChatAiListing from "./ChatAiListing";
import ChatAiContent from "./ChatAiContent";
import ChatAiMsgSent from "./ChatAiMsgSent";
import { ChatAIContext } from "@/app/context/aichat-context";
import ChatWindow from "./ChatWindow";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatAIMessage } from "@/app/(DashboardLayout)/types/apps/ai-chat";

const ChatAppAi = () => {
  const [isOpenChatAi, setIsOpenChatAi] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);
  const { sendMessage, setChatList } = useContext(ChatAIContext)!;

  const handleClose = () => setIsOpenChatAi(false);

  const handleStartChat = async (suggestionText: string) => {
    setShowChatWindow(true);
    await sendMessage(suggestionText, true);
  };

  const handleSearchSubmit = async (text: string) => {
    if (!text.trim()) return;
    await handleStartChat(text);
  };

  const handleFileUpload = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);
    setShowChatWindow(true);
    setChatList((prev: ChatAIMessage[]) => [
      ...prev,
      {
        id: Date.now(),
        sender: "user",
        text: "",
        imageUrl,
      },
    ]);
    await sendMessage("Here is an image I uploaded.", true);
  };

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <div className="flex min-h-[600px] h-[calc(100vh - 300px)]">
          {/* ------------------------------------------- */}
          {/* Left Part */}
          {/* ------------------------------------------- */}
          <Sheet open={isOpenChatAi} onOpenChange={handleClose}>
            <SheetContent
              side="left"
              className="lg:hidden max-w-[350px] w-full"
            >
              <ChatAiListing setShowChatWindow={setShowChatWindow} />
            </SheetContent>
          </Sheet>
          <div className="hidden lg:block max-w-[350px] w-full">
            <ChatAiListing setShowChatWindow={setShowChatWindow} />
          </div>
          {/* ------------------------------------------- */}
          {/* Right part */}
          {/* ------------------------------------------- */}
          <div className="grow w-[70%] shrink-0 flex flex-col">
            {!showChatWindow ? (
              <ChatAiContent
                onClickMobile={() => setIsOpenChatAi(true)}
                setShowChatWindow={setShowChatWindow}
                handleStartChat={handleStartChat}
              />
            ) : (
              <ChatWindow onClickMobile={() => setIsOpenChatAi(true)} />
            )}

            {/* <ChatMsgSent /> */}
            <ChatAiMsgSent
              onSearchSubmit={handleSearchSubmit}
              onFileUpload={handleFileUpload}
            />
          </div>
        </div>
      </Card>
    </>
  );
};

export default ChatAppAi;
