import React, { useState, useContext } from "react";
import { TbThumbUp } from "react-icons/tb";
import { Icon } from "@iconify/react";
import uniqueId from "lodash/uniqueId";
import PostComments from "./PostComments";
import {
  Comment as CommentType,
  PostType,
} from "../../../../(DashboardLayout)/types/apps/userprofile";
import { Card } from "@/components/ui/card";
import {
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
  Tooltip,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarFallback, AvatarImage, Avatar } from "@/components/ui/avatar";
import Image from "next/image";
import {
  UserDataContext,
  UserDataContextType,
} from "@/app/context/userdata-context/index";

interface Props {
  post: PostType;
}

const PostItem = ({ post }: Props) => {
  const { likePost, addComment } = useContext(
    UserDataContext
  ) as UserDataContextType;
  const [comText, setComText] = useState<string>("");

  const handleLike = (postId: string | number | undefined) => {
    if (postId) {
      likePost(postId);
    }
  };

  const onSubmit = async (
    postId: string | number | undefined,
    comment: string
  ) => {
    if (!postId) return;
    const commentId = uniqueId("#COMMENT_");
    const newComment: CommentType = {
      id: commentId,
      profile: {
        id: uniqueId("#COMMENT_"),
        avatar: post?.profile.avatar,
        name: post?.profile.name,
        time: "now",
      },
      data: {
        comment: comment,
        likes: {
          like: false,
          value: 0,
        },
        replies: [],
      },
    };
    addComment(postId.toString(), newComment);
    setComText("");
  };

  return (
    <>
      <Card className="p-0">
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post?.profile.avatar} />
              <AvatarFallback>profile</AvatarFallback>
            </Avatar>
            <h6>{post?.profile.name}</h6>
            <p className="flex items-center gap-2">
              <span className="h-[6px] w-[6px] rounded-full bg-dark opacity-40 dark:bg-white block"></span>
              {post?.profile.time}
            </p>
          </div>
          {/**Post Content**/}
          <p className="text-darklink text-sm py-4">{post?.data.content}</p>
          {/**If Post has Image**/}
          {post.data.images.length > 0 ? (
            <div className="grid grid-cols-12 md:gap-6 gap-0">
              {post?.data.images.map((photo, index) => {
                return (
                  <div
                    key={index}
                    className={`lg:col-span-${
                      photo.featured ? 12 : 6
                    } md:col-span-12 col-span-12`}
                  >
                    <div className="h-[360px] overflow-hidden rounded-md mb-6">
                      <Image
                        src={photo.img}
                        alt="coverbanner"
                        width={360}
                        height={40}
                        className="rounded-md h-full object-cover object-top"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            ""
          )}
          {/**If Post has Video**/}
          {post?.data.video ? (
            <iframe
              className="w-full aspect-video rounded-md"
              src={`https://www.youtube.com/embed/${post?.data.video}`}
            ></iframe>
          ) : (
            ""
          )}

          {/**Post Like Comment Share buttons**/}
          <TooltipProvider>
            <div className="flex gap-5 mt-6">
              <div className="flex items-center gap-3 cursor-pointer text-dark font-medium text-primary-ld">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="btn-circle p-0 rounded-full"
                      variant={
                        post?.data && post?.data.likes && post?.data.likes.like
                          ? "default"
                          : "ghost"
                      }
                      onClick={() => handleLike(post?.id)}
                    >
                      <TbThumbUp size="16" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Like</TooltipContent>
                </Tooltip>
                <span className="font-semibold text-ld text-sm">
                  {post?.data && post?.data.likes && post?.data.likes.value}
                </span>
              </div>
              <div className="flex items-center gap-3 cursor-pointer text-dark font-medium text-primary-ld">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="btn-circle p-0 rounded-full"
                      variant={"secondary"}
                    >
                      <Icon icon="tabler:message-2" height="16" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Comment</TooltipContent>
                </Tooltip>
                <span className="font-semibold text-ld text-sm">
                  {post?.data.comments ? post?.data.comments.length : 0}
                </span>
              </div>
              <div className="ms-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="btn-circle p-0 rounded-full"
                      variant={"link"}
                    >
                      <Icon icon="solar:share-outline" height="16" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>

          {/**Comments if any**/}
          <div>
            {post?.data.comments ? (
              <>
                {post?.data.comments.map((comment) => {
                  return (
                    <PostComments
                      comment={comment}
                      key={comment.id}
                      post={post}
                    />
                  );
                })}
              </>
            ) : (
              ""
            )}
          </div>
        </div>
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-4"></div>
        <div className="flex gap-3 items-center justify-between px-6 pb-6">
          <div className="w-14">
            <Avatar>
              <AvatarImage src={post?.profile.avatar} />
              <AvatarFallback>profile</AvatarFallback>
            </Avatar>
          </div>
          <Input
            type="text"
            className="form-control sm:w-full w-auto"
            placeholder="Comment"
            value={comText}
            onChange={(e) => setComText(e.target.value)}
          />
          <Button
            onClick={() => onSubmit(post?.id, comText)}
            className="rounded-md"
          >
            Comment
          </Button>
        </div>
      </Card>
    </>
  );
};

export default PostItem;
