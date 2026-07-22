import Image from "next/image"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export const FavouriteArtists = () => {
    const Artists = [
        {
            key: "artist1",
            profile: '/images/music/s1.jpg'
        },
        {
            key: "artist2",
            profile: '/images/music/s2.jpg'
        },
        {
            key: "artist3",
            profile: '/images/music/s3.jpg'
        },
        {
            key: "artist4",
            profile: '/images/music/s4.jpg'
        },
        {
            key: "artist5",
            profile: '/images/music/s1.jpg'
        },
    ]
    return (
        <Card>
            <div className="mb-6">
                <h6 className="card-title">Favourite Artists</h6>
                <p className="card-subtitle">The iconic music of princep</p>
            </div>
            <Link href="#" className="flex gap-4 lg:justify-start sm:justify-between flex-wrap">
                {
                    Artists.map((item) => {
                        return (
                            <Image key={item.key} src={item.profile} width={67} height={67} alt="profile-image" className="rounded-md hover:scale-[1.03] duration-300" />
                        )
                    })
                }
            </Link>
        </Card>
    )
}