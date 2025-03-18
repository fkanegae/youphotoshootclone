import Marquee from "@/components/magicui/marquee";
import Image from "next/image";

const companies = [
  {
    name: "Google",
    logo: "/logos/google.svg"
  },
  {
    name: "Microsoft",
    logo: "/logos/microsoft.svg"
  },
  {
    name: "Amazon",
    logo: "/logos/amazon.svg"
  },
  {
    name: "Mckinsey",
    logo: "/logos/mckinsey.svg"
  },
  {
    name: "YouTube",
    logo: "/logos/youtube.svg"
  },
  {
    name: "JpMorgan",
    logo: "/logos/jpmorgan.svg"
  },
  {
    name: "Uber",
    logo: "/logos/uber.svg"
  },
  {
    name: "Spotify",
    logo: "/logos/spotify.svg"
  }
];

export function Companies() {
  return (
    <section id="companies" className="bg-mainWhite w-full">
      <div className="w-full px-4 md:px-8 py-12">
        <div className="flex items-center justify-center">
          <svg
            className="w-6 h-6 mr-2 text-mainBlack"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xl text-center text-mainBlack">
            TRUSTED BY PROFESSIONALS FROM INDUSTRY LEADERS LIKE
          </p>
        </div>
        <div className="relative mt-6">
          <Marquee className="max-w-none [--duration:40s]">
            {companies.map((company, idx) => (
              <Image
                key={idx}
                width={160}
                height={60}
                src={company.logo}
                className="h-14 w-40 grayscale opacity-60 filter contrast-75 dark:brightness-0 dark:invert mx-12 transition-opacity hover:opacity-100"
                alt={company.name}
              />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 h-full w-1/3 bg-gradient-to-r from-mainWhite"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/3 bg-gradient-to-l from-mainWhite"></div>
        </div>
      </div>
    </section>
  );
} 