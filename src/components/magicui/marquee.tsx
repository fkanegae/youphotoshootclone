import { cn } from "@/lib/utils";
import React from "react";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  pauseOnHover?: boolean;
  reverse?: boolean;
  fade?: boolean;
}

const Marquee = ({
  children,
  className,
  pauseOnHover = false,
  reverse = false,
  fade = true,
  ...props
}: MarqueeProps) => {
  return (
    <div
      {...props}
      className={cn("flex w-full overflow-hidden", className)}
    >
      <div
        className={cn(
          "flex min-w-full shrink-0 animate-marquee items-center justify-around gap-4",
          pauseOnHover && "hover:[animation-play-state:paused]",
          reverse && "animate-marquee-reverse"
        )}
      >
        {children}
      </div>
      <div
        className={cn(
          "flex min-w-full shrink-0 animate-marquee items-center justify-around gap-4",
          pauseOnHover && "hover:[animation-play-state:paused]",
          reverse && "animate-marquee-reverse"
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default Marquee; 