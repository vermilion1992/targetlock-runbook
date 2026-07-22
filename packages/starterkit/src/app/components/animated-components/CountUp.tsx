import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useEffectEvent, useState } from "react";

interface CountUpProps {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  formatWithCommas?: boolean; // new prop, defaults to true
}

export default function CountUp({
  from = 0,
  to,
  duration = 2,
  className,
  formatWithCommas = true, // default to true
}: CountUpProps) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => Math.floor(latest));
  const [display, setDisplay] = useState(
    formatWithCommas ? from.toLocaleString() : from.toString()
  );

  //   useEffect(() => {
  //     const controls = animate(count, to, { duration });
  //     const unsubscribe = rounded.on("change", (v) => {
  //       setDisplay(formatWithCommas ? v.toLocaleString() : v.toString());
  //     });
  //     return () => {
  //       controls.stop();
  //       unsubscribe();
  //     };
  //   }, [count, rounded, to, duration, formatWithCommas]);

  const handleChange = useEffectEvent((v: number) => {
    setDisplay(formatWithCommas ? v.toLocaleString() : v.toString());
  });

  useEffect(() => {
    const controls = animate(count, to, { duration });
    const unsubscribe = rounded.on("change", handleChange);
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, to, duration]);

  return <motion.span className={className}>{display}</motion.span>;
}
