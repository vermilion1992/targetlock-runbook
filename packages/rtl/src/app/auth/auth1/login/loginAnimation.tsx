"use client"
import React from "react";
import Lottie from "lottie-react";
import login from '@/../public/animation/login.json'

const loginAnimation = () => <Lottie animationData={login} loop={true} />;

export default loginAnimation;