"use client";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { GoDot } from "react-icons/go";
import { format } from "date-fns";
import { BlogPostType } from "../../../(DashboardLayout)/types/apps/blog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BlogContext,
  BlogContextProps,
} from "@/app/context/blog-context/index";
import React, { useEffect, useContext } from "react";
import Image from "next/image";

interface Btype {
  post: BlogPostType;
  index: number;
}
const BlogFeaturedCard = ({ post, index }: Btype) => {
  const { coverImg, title, view, comments, category, author, createdAt } = post;
  const linkTo = title
    ? title
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "")
    : "";
  const mainPost = index === 0;
  const { setLoading }: BlogContextProps = useContext(BlogContext);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {post ? (
        <div
          className={`lg:col-span-${
            mainPost ? 8 : 4
          } md:col-span-12 col-span-12`}
        >
          <Card className="w-full h-[400px] p-0 overflow-hidden flex-row shadow-none feature-card relative card-hover">
            {/* Background Image */}
            <div className="absolute inset-0">
              <Image
                src={coverImg || ""}
                alt={title || "blog image"}
                className="w-full h-full object-cover"
                width={786}
                height={400}
              />
              <div className="absolute inset-0 bg-black opacity-50 mix-blend-multiply"></div>
            </div>
            <div className="absolute w-full h-full left-0 p-6">
              <div className="flex flex-col h-full justify-between ">
                <div className="flex justify-between items-center">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={author?.avatar} alt={author?.name} />
                    <AvatarFallback>
                      {author?.name ? author.name[0] : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Badge className="rounded-md">{category}</Badge>
                </div>
                <div>
                  <h2 className="text-2xl text-white my-6">
                    <Link href={`/apps/blog/detail/${linkTo}`}> {title}</Link>
                  </h2>
                  <div className="flex  gap-3">
                    <div className="flex gap-2 items-center text-white text-[15px]">
                      <Icon icon="tabler:eye" height="18" /> {view}
                    </div>
                    <div className="flex gap-2 items-center text-white text-[15px]">
                      <Icon icon="tabler:message-2" height="18" />{" "}
                      {comments?.length}
                    </div>
                    <div className="ms-auto flex gap-2 items-center text-white text-[15px]">
                      <GoDot size="16" />
                      <small>
                        {createdAt
                          ? format(new Date(createdAt), "E, MMM d")
                          : ""}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
};
export default BlogFeaturedCard;
