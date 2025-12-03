import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Static export doesn't need trailing slashes for our use case
  trailingSlash: false,
};

export default nextConfig;
