"use client";
import Slider from "react-slick";
import * as ClientRev from "../data";
import React, { useContext } from "react";
import Image from "next/image";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Card } from "@/components/ui/card";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { CustomizerContext } from "@/app/context/customizer-context";

const ClientReviews = () => {
  const renderStars = (rating: number) => {
    const totalStars = 5;
    let stars = [];
    for (let i = 1; i <= totalStars; i++) {
      stars.push(
        <Icon
          key={i}
          icon={i <= rating ? "solar:star-bold" : "solar:star-linear"}
          className={`w-5 h-5 ${
            i <= rating ? "text-yellow-400" : "text-gray-300"
          }`}
        />
      );
    }
    return stars;
  };
  const settings = {
    className: "center",
    infinite: true,
    centerPadding: "60px",
    slidesToShow: 3,
    swipeToSlide: true,
    dots: true,
    arrows: false,
    responsive: [
      {
        breakpoint: 1199,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
          infinite: true,
          dots: true,
        },
      },
      {
        breakpoint: 767,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  const { activeMode } = useContext(CustomizerContext);
  const trustPilotLogo =
    activeMode === "dark"
      ? "/images/svgs/logo-truestpilot-dark.svg"
      : "/images/svgs/logo-truestpilot.svg";

  return (
    <>
      <div className="bg-white dark:bg-dark">
        <div className="container md:py-20 py-12 ">
          <div
            className="lg:w-3/5 w-full mx-auto"
            data-aos="fade-up"
            data-aos-duration="500"
          >
            <h2
              className="text-center sm:text-4xl text-2xl mt-8 font-bold sm:!leading-[45px]"
              data-aos="fade-up"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Don’t just take our words for it, See what developers like you are
              saying
            </h2>
          </div>
          <div
            className="slider-container client-reviews pt-14"
            data-aos="fade-up"
            data-aos-delay="400"
            data-aos-duration="1000"
          >
            <Slider {...settings}>
              {ClientRev.userReview.map((item, index) => (
                <div key={index}>
                  <Link href={item.link} target="_blank">
                    <Card className="bg-lightgray dark:bg-darkmuted">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 items-center">
                          <Image
                            src={item.img}
                            alt="review"
                            className="h-10 w-10 rounded-full"
                            width={40}
                            height={40}
                          />
                          <div>
                            <h6 className="text-base">{item.title}</h6>
                            <p className="text-sm text-ld opacity-80 truncate text-ellipsis max-w-32">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <Image
                          src={trustPilotLogo}
                          alt="Truestpilot"
                          width={80}
                          height={40}
                        />
                      </div>
                      <p className="text-sm text-ld opacity-90 pt-4 line-clamp-3">
                        {item.review}
                      </p>
                      <div className="flex mt-3">
                        {renderStars(item.rating)}
                      </div>
                    </Card>
                  </Link>
                </div>
              ))}
            </Slider>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientReviews;
