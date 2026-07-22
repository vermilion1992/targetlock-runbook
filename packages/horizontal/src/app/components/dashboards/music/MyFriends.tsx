import Image from "next/image"
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const MyFriends = () => {
    const Friends = [
        {
            key: "friend1",
            profile: '/images/profile/user-5.jpg'
        },
        {
            key: "friend2",
            profile: '/images/profile/user-2.jpg'
        },
        {
            key: "friend3",
            profile: '/images/profile/user-3.jpg'
        },
        {
            key: "friend4",
            profile: '/images/profile/user-4.jpg'
        },
        {
            key: "friend5",
            profile: '/images/profile/user-5.jpg'
        },
    ]
    return (
        <Card>
            <div className="mb-6">
                <h6 className="card-title">My Friends</h6>
                <p className="card-subtitle">The power of friendship</p>
            </div>
            <Link href="#" className="flex gap-4 lg:justify-start sm:justify-between flex-wrap">
                {
                    Friends.map((item) => {
                        return (
                            <Image key={item.key} src={item.profile} width={67} height={67} alt="profile-image" className="rounded-md hover:scale-[1.03] duration-300" />
                        )
                    })
                }
            </Link>
        </Card>
    )
}