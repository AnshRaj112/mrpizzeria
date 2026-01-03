import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: '**.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'www.britannica.com',
      },
      {
        protocol: 'https',
        hostname: '**.britannica.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.imgur.com',
      },
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: '**.wikipedia.org',
      },
      {
        protocol: 'https',
        hostname: 'media-assets.swiggy.com',
      },
      {
        protocol: 'https',
        hostname: 'safrescobaldistatic.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'static.toiimg.com',
      },
      {
        protocol: 'https',
        hostname: 'instamart-media-assets.swiggy.com',
      },
      {
        protocol: 'https',
        hostname: 'www.elloras.in',
      },
    ],
    // Allow unoptimized images as fallback for any other domains
    unoptimized: false,
  },
};

export default nextConfig;
