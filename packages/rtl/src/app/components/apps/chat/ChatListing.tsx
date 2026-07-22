import { HiOutlineDotsVertical } from "react-icons/hi";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import React, { useContext } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { last } from "lodash";
import { formatDistanceToNowStrict } from "date-fns";
import { ChatsType } from "@/app/(DashboardLayout)/types/apps/chat";
import SimpleBar from "simplebar-react";
import { ChatContext } from "@/app/context/chat-context/index";

const ChatListing = () => {
  const DropdownAction = [
    {
      icon: "solar:settings-outline",
      listtitle: "Setting",
      divider: true,
    },
    {
      icon: "solar:question-circle-outline",
      listtitle: "Help and feedback",
      divider: false,
    },
    {
      icon: "solar:align-horizonta-spacing-line-duotone",
      listtitle: "Enable split View mode",
      divider: false,
    },
    {
      icon: "solar:keyboard-outline",
      listtitle: "Keyboard shortcut",
      divider: true,
    },
    {
      icon: "solar:logout-2-outline",
      listtitle: "Sign Out",
      divider: false,
    },
  ];

  const lastActivity = (chat: ChatsType) => last(chat.messages)?.createdAt;

  const getDetails = (conversation: ChatsType) => {
    let displayText = "";
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage) {
      const sender = lastMessage.senderId === conversation.id ? "You: " : "";
      const message =
        lastMessage.type === "image" ? "Sent a photo" : lastMessage.msg;
      displayText = `${sender}${message}`;
    }
    return displayText;
  };

  const {
    chatData,
    chatSearch,
    setChatSearch,
    setSelectedChat,
    setActiveChatId,
    activeChatId,
  } = useContext(ChatContext);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChatSearch(event.target.value);
  };

  const filteredChats = chatData.filter((chat) =>
    chat.name.toLowerCase().includes(chatSearch.toLowerCase())
  );

  const handleChatSelect = (chat: ChatsType) => {
    const chatId =
      typeof chat.id === "string" ? parseInt(chat.id, 10) : chat.id;
    setSelectedChat(chat);
    setActiveChatId(chatId);
  };

  return (
    <>
      <div className="left-part w-full px-0">
        {/* Header */}
        <div className="flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/profile/user-1.jpg"
                height={56}
                width={56}
                alt="user"
                className="rounded-full"
              />
              <Badge
                variant={"success"}
                className="p-0 h-2 w-2 absolute bottom-1 end-0"
              />
            </div>
            <div>
              <h5 className="text-sm mb-1">Mathew Anderson</h5>
              <p className="text-darklink text-xs">Designer</p>
            </div>
          </div>

          {/* ShadCN Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                <HiOutlineDotsVertical size={22} />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {DropdownAction.map((item, index) => (
                <React.Fragment key={index}>
                  <DropdownMenuItem className="flex items-center gap-3 cursor-pointer">
                    <Icon icon={item.icon} height={18} />
                    <span>{item.listtitle}</span>
                  </DropdownMenuItem>
                  {item.divider && <DropdownMenuSeparator />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search Box */}
        <div className="px-6">
          <div className="flex gap-3 bg-white dark:bg-transparent py-5 items-center">
            <div className="relative w-full">
              <Icon
                icon="solar:magnifer-line-duotone"
                height={18}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                type="text"
                className="pl-8"
                onChange={handleSearchChange}
                placeholder="Search"
              />
            </div>
          </div>

          {/* Sorting Dropdown (Also converted to ShadCN) */}
          <div className="sorting mb-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer text-sm font-medium text-dark hover:text-primary dark:text-white">
                  Recent Chats
                  <Icon icon="ci:chevron-down" width={16} height={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuItem>Sort by Time</DropdownMenuItem>
                <DropdownMenuItem>Sort by Unread</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Sort by Favourites</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Chat Listing */}
        <SimpleBar className="lg:h-[calc(100vh_-_520px)] h-[calc(100vh_-_200px)]">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`cursor-pointer py-4 px-6 gap-0 flex justify-between group bg-hover ${
                activeChatId === chat.id
                  ? "bg-lightprimary dark:bg-lightprimary"
                  : "initial"
              }`}
              onClick={() => handleChatSelect(chat)}
            >
              <div className="flex items-center gap-3 max-w-[235px] w-full">
                <div className="relative min-w-12">
                  <Image
                    src={chat.thumb}
                    height={48}
                    width={48}
                    alt="user"
                    className="rounded-full"
                  />
                  <Badge
                    variant={
                      chat.status === "online"
                        ? "success"
                        : chat.status === "busy"
                        ? "error"
                        : chat.status === "away"
                        ? "warning"
                        : "primary"
                    }
                    className="p-0 h-2 w-2 absolute bottom-1 end-0"
                  />
                </div>
                <div>
                  <h5 className="text-sm mb-1">{chat.name}</h5>
                  <div className="text-sm text-ld font-normal text-bodytext dark:text-darklink line-clamp-1">
                    {getDetails(chat)}
                  </div>
                </div>
              </div>
              <div className="text-xs pt-1 whitespace-nowrap">
                {formatDistanceToNowStrict(new Date(lastActivity(chat)!), {
                  addSuffix: false,
                })}
              </div>
            </div>
          ))}
        </SimpleBar>
      </div>
    </>
  );
};

export default ChatListing;
