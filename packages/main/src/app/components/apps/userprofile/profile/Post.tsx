import React, { useContext } from "react";
import PostBox from "./PostBox";
import PostIem from "./PostItem";
import { UserDataContext } from "@/app/context/userdata-context/index";

const Post = () => {
  const { posts } = useContext(UserDataContext)!;

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <PostBox />
        </div>
        {posts.map((post) => {
          return (
            <div key={post.id} className="col-span-12">
              <PostIem post={post} />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default Post;
