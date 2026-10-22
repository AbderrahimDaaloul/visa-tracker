import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "nodemailer"],
  turbopack: {},
};

export default nextConfig;
