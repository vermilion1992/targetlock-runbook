"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AnimatedTableWrapper,
  AnimatedTableBody,
  AnimatedTableRow,
} from "@/app/components/animated-components/AnimatedTable";

// Custom simple RatingStars component for displaying rating stars
const RatingStars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex space-x-1 mt-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 ${
            star <= rating ? "text-yellow-400" : "text-gray-300"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
          stroke="none"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.39 2.462a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118l-3.39-2.462a1 1 0 00-1.176 0l-3.39 2.462c-.784.57-1.838-.197-1.539-1.118l1.287-3.974a1 1 0 00-.364-1.118L2.045 9.4c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69l1.286-3.974z" />
        </svg>
      ))}
    </div>
  );
};

const LatestReviewData = [
  {
    profile: "/images/profile/user-2.jpg",
    customername: "Arlene McCoy",
    customeremail: "macoy@arlene.com",
    review: 5,
    reviewtext: "I like this design",
    time: "1 day ago",
  },
  {
    profile: "/images/profile/user-3.jpg",
    customername: "Jerome Bell",
    customeremail: "belljerome@yahoo.com",
    review: 4,
    reviewtext:
      "Awesome quality with great materials used, but could be more comfortable",
    time: "Today",
  },
  {
    profile: "/images/profile/user-4.jpg",
    customername: "Jacob Jones",
    customeremail: "jones009@hotmail.com",
    review: 4,
    reviewtext:
      "The best experience we could hope for.Customer service team is amazing and thequality of their products",
    time: "Nov 8",
  },
  {
    profile: "/images/profile/user-5.jpg",
    customername: "Annette Black",
    customeremail: "blackanne@yahoo.com",
    review: 3,
    reviewtext:
      "The controller is quite comfy for me. Despiteits increased size, the controller still fits well",
    time: "Nov 10",
  },
  {
    profile: "/images/profile/user-3.jpg",
    customername: "Jerome Bell",
    customeremail: "belljerome@yahoo.com",
    review: 4,
    reviewtext:
      "Awesome quality with great materials used, but could be more comfortable",
    time: "Today",
  },
  {
    profile: "/images/profile/user-4.jpg",
    customername: "Jacob Jones",
    customeremail: "jones009@hotmail.com",
    review: 4,
    reviewtext:
      "The best experience we could hope for.Customer service team is amazing and thequality of their products",
    time: "Nov 8",
  },
  {
    profile: "/images/profile/user-5.jpg",
    customername: "Annette Black",
    customeremail: "blackanne@yahoo.com",
    review: 3,
    reviewtext:
      "The controller is quite comfy for me. Despiteits increased size, the controller still fits well",
    time: "Nov 10",
  },
];

const CustomerReviews = () => {
  return (
    <Card>
      <h5 className="card-title mb-2">Customer Reviews</h5>
      <AnimatedTableWrapper className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold pb-2">
                Customer
              </TableHead>
              <TableHead className="text-sm font-semibold pb-2">
                Comment
              </TableHead>
              <TableHead className="text-sm font-semibold pb-2">Date</TableHead>
            </TableRow>
          </TableHeader>
          <AnimatedTableBody className="divide-y divide-border dark:divide-darkborder">
            {LatestReviewData.map((item, index) => (
              <AnimatedTableRow key={index} index={index}>
                <TableCell className="whitespace-nowrap ps-6 md:min-w-auto min-w-[200px]">
                  <div className="flex gap-3 items-center">
                    <Image
                      src={item.profile}
                      alt={item.customername}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full"
                    />
                    <h6 className="text-base">{item.customername}</h6>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal md:min-w-auto min-w-[200px]">
                  <RatingStars rating={item.review} />
                  <p className="text-darklink line-clamp-2 max-w-56 text-sm mt-1">
                    {item.reviewtext}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <p className="text-darklink text-sm">{item.time}</p>
                </TableCell>
              </AnimatedTableRow>
            ))}
          </AnimatedTableBody>
        </Table>
      </AnimatedTableWrapper>
    </Card>
  );
};

export default CustomerReviews;
