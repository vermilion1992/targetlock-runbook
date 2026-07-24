/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
}

export default nextConfig