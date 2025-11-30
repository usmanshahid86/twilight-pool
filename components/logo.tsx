"use client";
import cn from "@/lib/cn";
import { useTheme } from "next-themes";
import Image from "next/image";
import React, { useEffect, useState } from "react";

type Props = {
  className?: string;
};

const Logo = ({ className }: Props) => {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  const logoName = theme === "dark" || !mounted ? "logo-dark" : "logo";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <Image
        className={cn("hidden md:block", className)}
        src={`/images/${logoName}.svg`}
        alt="Logo"
        width={108}
        height={24}
        quality={100}
      />

      <Image
        className={cn("block md:hidden", className)}
        src={`/images/twilight.svg`}
        alt="Logo"
        width={108}
        height={24}
        quality={100}
      />
    </>
  );
};

export default Logo;
