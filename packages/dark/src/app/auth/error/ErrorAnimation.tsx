"use client"
import React from "react";
import Lottie from "lottie-react";
import error404page from '@/../public/animation/error404page.json'

const errorAnimation = () => <Lottie animationData={error404page} loop={true} />;

export default errorAnimation;
