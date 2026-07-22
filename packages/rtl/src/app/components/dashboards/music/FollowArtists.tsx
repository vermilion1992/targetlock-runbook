import Image from "next/image"
import { Card } from "@/components/ui/card";

export const FollowArtists = () => {
    const Artists = [
        {
            key: "artist1",
            profile: '/images/music/s1.jpg',
            name: "Dualia"
        },
        {
            key: "artist2",
            profile: '/images/music/s2.jpg',
            name: "John"
        },
        {
            key: "artist3",
            profile: '/images/music/s3.jpg',
            name: "Smith"
        },
        {
            key: "artist4",
            profile: '/images/music/s4.jpg',
            name: "Sia"
        },
        {
            key: "artist5",
            profile: '/images/music/s1.jpg',
            name: "Adele"
        },
        {
            key: "artist6",
            profile: '/images/music/s2.jpg',
            name: "Dualia"
        },
        {
            key: "artist7",
            profile: '/images/music/s3.jpg',
            name: "Sia"
        },
        {
            key: "artist8",
            profile: '/images/music/s4.jpg',
            name: "Kathy"
        },
        {
            key: "artist9",
            profile: '/images/music/s1.jpg',
            name: "Dualia"
        },
        {
            key: "artist10",
            profile: '/images/music/s2.jpg',
            name: "John"
        },
    ]
    return (
        <Card>
            <div className="mb-6">
                <h6 className="card-title">Follow Artists</h6>
                <p className="card-subtitle">Tips for following local artists</p>
            </div>
            <div className="flex items-center gap-5 overflow-x-auto">
                {
                    Artists.map((item) => {
                        return (
                            <div key={item.key} className="cursor-pointer group shrink-0">
                                <div className={`p-1 border-2 border-ld group-hover:border-primary duration-300 box-content rounded-full`}>
                                    <Image src={item.profile} alt="music-profile" width={56} height={56} className="w-14 h-14 rounded-full group-hover:scale-105 duration-300" />
                                </div>
                                <p className="mt-1 text-center">{item.name}</p>
                            </div>
                        )
                    })
                }
            </div>
        </Card>
    )
}