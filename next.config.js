/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // ✅ Static export

  images: {
    unoptimized: true, // Required for static export
  },
  transpilePackages: ["lightweight-charts"],
  webpack: (config) => {
    config.externals.push(
      // nextjs bundler cant correctly resolve deeply nested client and server dependencies, temporary fix
      "pino-pretty",
      "lokijs",
      "bufferutil",
      "utf-8-validate"
    );
    config.experiments = { asyncWebAssembly: true, layers: true };
    return config;
  },
};

module.exports = nextConfig;
