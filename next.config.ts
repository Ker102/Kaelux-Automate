import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig & { turbopack: { root: string } } = {
  reactCompiler: true,
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
