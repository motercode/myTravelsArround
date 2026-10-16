import type { NextConfig } from "next";

// Netlify despliega Next.js con su adaptador OpenNext (@netlify/plugin-nextjs),
// que se instala automáticamente: no hace falta `output: "standalone"`.
const nextConfig: NextConfig = {
  reactStrictMode: false,
};

export default nextConfig;
