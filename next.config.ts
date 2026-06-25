import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ne ignoriši TypeScript greške pri buildu - hvata bugove rano
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Dozvoli cross-origin Server Actions u preview/proxy okruženjima
  // Na Vercelu u produkciji ovo nije potrebno jer je sve na istom domenu
  // Za custom domene, postavite PRODUCTION_DOMAIN env varijablu
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        ...(process.env.PRODUCTION_DOMAIN ? [process.env.PRODUCTION_DOMAIN] : []),
      ],
    },
  },
};

export default nextConfig;
