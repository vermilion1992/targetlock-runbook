import ChatAppAi from "@/app/components/apps/chat-ai";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import type { Metadata } from "next";
import { ChatAIProvider } from "@/app/context/aichat-context";

export const metadata: Metadata = {
  title: "Chat-AI",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Chat-AI",
  },
];
const ChatAi = () => {
  return (
    <>
      <ChatAIProvider>
        <BreadcrumbComp title="Chat-AI" items={BCrumb} />
        <ChatAppAi />
      </ChatAIProvider>
    </>
  );
};

export default ChatAi;
