"use client";

import { motion } from "framer-motion";
import { AuroraBackground } from "./aurora-background";
import Link from "next/link";

export default function HeroSection() {
  return (
    <AuroraBackground>
      {/* Animated Headline */}
      <h1 className="relative z-10 mx-auto max-w-4xl text-center text-2xl font-bold text-white md:text-4xl lg:text-7xl">
        {"Turn food photos into recipes".split(" ").map((word, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{
              duration: 0.3,
              delay: index * 0.1,
              ease: "easeInOut",
            }}
            className="mr-2 inline-block"
          >
            {word}
          </motion.span>
        ))}
      </h1>

      {/* Supporting Paragraph */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.8 }}
        className="relative z-10 mx-auto max-w-xl py-4 text-center text-lg font-normal text-white"
      >
        Snap a photo of your meal and get instant ingredient analysis +
        AI-powered recipe suggestions—perfect for foodies and home cooks.
      </motion.p>

      {/* Call-to-Action Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 1 }}
        className="relative z-10 mt-8 flex justify-center"
      >
        <Link href="/dashboard">
          <button
            className="
              rounded-lg bg-gradient-to-r from-[#0096FF] via-[#0066CC] to-[#215198]
              px-6 py-2 font-medium text-white transition-all duration-300 hover:opacity-90 cursor-pointer
            "
          >
            Try it now
          </button>
        </Link>
      </motion.div>
    </AuroraBackground>
  );
}
