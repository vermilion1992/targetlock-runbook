"use client";
import { Icon } from "@iconify/react/dist/iconify.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import AnimatedItem from "@/app/components/animated-components/ListAnimation";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import Image from "next/image";

export const TopPlaylists = () => {
  const Playlists = [
    {
      key: "album1",
      albumProfile: "/images/music/album1.jpg",
      album: "N95",
      artist: "Kendrick Lamar",
      isFavourite: true,
    },
    {
      key: "album2",
      albumProfile: "/images/music/album2.jpg",
      album: "Women",
      artist: "Doja Cat",
      isFavourite: true,
    },
    {
      key: "album3",
      albumProfile: "/images/music/album3.jpg",
      album: "Wait For U",
      artist: "Future, Tems",
      isFavourite: false,
    },
    {
      key: "album4",
      albumProfile: "/images/music/album4.jpg",
      album: "Binding Lights",
      artist: "The Weeknd",
      isFavourite: false,
    },
    {
      key: "album5",
      albumProfile: "/images/music/album5.jpg",
      album: "Cooped Up",
      artist: "Roddy Rich",
      isFavourite: false,
    },
    {
      key: "album6",
      albumProfile: "/images/music/album6.jpg",
      album: "N95",
      artist: "Roddy Rich",
      isFavourite: true,
    },
    {
      key: "album7",
      albumProfile: "/images/music/album7.jpg",
      album: "Party Anthem",
      artist: "Arjit Singh",
      isFavourite: true,
    },
  ];
  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h6 className="card-title">Top Playlist</h6>
            <p className="card-subtitle">Based on your choice</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Icon
                icon="tabler:dots-vertical"
                className="text-muted dark:text-darklink hover:text-primary dark:hover:text-primary text-lg shrink-0 cursor-pointer"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left" align="start">
              <DropdownMenuItem>
                <div className="flex gap-2 items-center text-muted dark:text-darklink">
                  <Icon icon="tabler:share" className="text-base" />
                  Share
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex gap-2 items-center text-muted dark:text-darklink">
                  <Icon icon="tabler:download" className="text-base" />
                  Download
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex gap-2 items-center text-muted dark:text-darklink">
                  <Icon icon="tabler:playlist" className="text-base" />
                  Add to queue
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SimpleBar style={{ maxHeight: 450 }}>
          <ul className="flex flex-col border border-ld rounded-md">
            {Playlists.map((item, index) => {
              return (
                <AnimatedItem key={item.key} index={index}>
                  <li
                    key={item.key}
                    className="w-full hover:bg-lightprimary dark:hover:bg-lightprimary px-4 py-3 rounded-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-3 items-center">
                        <Icon
                          icon="tabler:player-play"
                          className="text-lg text-dark dark:text-white shrink-0"
                        />
                        <Image
                          src={item.albumProfile}
                          className="rounded-md h-10 w-10"
                          alt="album-image"
                          width={40}
                          height={40}
                        />
                        <div>
                          <h6 className="text-sm font-medium text-start">
                            {item.album}
                          </h6>
                          <p className="text-sm font-normal text-bodytext dark:text-darklink">
                            {item.artist}
                          </p>
                        </div>
                      </div>
                      <Icon
                        icon="solar:heart-bold"
                        className={`${
                          item.isFavourite
                            ? "text-error "
                            : "text-bodytext dark:text-darklink"
                        } text-lg shrink-0`}
                      />
                    </div>
                  </li>
                </AnimatedItem>
              );
            })}
          </ul>
        </SimpleBar>
      </div>
    </Card>
  );
};
