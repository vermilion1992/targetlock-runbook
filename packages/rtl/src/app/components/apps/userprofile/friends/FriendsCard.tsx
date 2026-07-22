import React, { useContext } from "react";
import {
  TbBrandFacebook,
  TbBrandGithub,
  TbBrandInstagram,
  TbBrandTwitter,
} from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { UserDataContext } from "@/app/context/userdata-context";
import { StaticImport } from "next/dist/shared/lib/get-img-props";
import { Card } from "@/components/ui/card";

const socialiconCard = [
  { icon: <TbBrandFacebook size={17} />, color: "primary" },
  { icon: <TbBrandInstagram size={17} />, color: "error" },
  { icon: <TbBrandGithub size={17} />, color: "info" },
  { icon: <TbBrandTwitter size={17} />, color: "secondary" },
];

const FriendsCard = () => {
  const { followers, setSearch } = useContext(UserDataContext);

  return (
    <>
      <div className="md:flex justify-between mb-6">
        <h5 className="text-2xl flex gap-3 items-center sm:my-0 my-4">
          Friends <Badge variant="secondary">{followers.length}</Badge>
        </h5>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Icon icon="solar:magnifer-line-duotone" height={18} />
          </span>
          <Input
            type="text"
            placeholder="Search Friends"
            className="pl-9"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {followers.map(
          (profile: {
            id: React.Key;
            avatar: string | StaticImport;
            name: string;
            role: string;
          }) => (
            <div
              className="lg:col-span-4 md:col-span-4 sm:col-span-6 col-span-12"
              key={profile.id}
            >
              <Card className="px-0 pb-0 text-center overflow-hidden">
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  className="rounded-full mx-auto"
                  height={80}
                  width={80}
                />
                <div>
                  <h5 className="text-lg mt-3">{profile.name}</h5>
                  <p className="text-xs text-darklink">{profile.role}</p>
                </div>
                <div className="flex justify-center gap-4 items-center border-t border-border dark:border-darkborder mt-4 pt-4 bg-lightgray pb-4 dark:bg-darkmuted">
                  {socialiconCard.map((soc, index) => (
                    <Link href="#" className={`text-${soc.color}`} key={index}>
                      {soc.icon}
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )
        )}
      </div>
    </>
  );
};

export default FriendsCard;
