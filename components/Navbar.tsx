"use client";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <span className="text-2xl font-bold text-blue-600 cursor-pointer" onClick={() => router.push("/")}>FlacronSport Daily</span>
          <nav className="hidden md:flex space-x-8">
            <button
              className="text-gray-700 hover:text-blue-600 font-medium bg-transparent border-none cursor-pointer"
              onClick={() => router.push("/")}
            >
              Live Scores
            </button>
            <button
              className="text-gray-700 hover:text-blue-600 font-medium bg-transparent border-none cursor-pointer"
              onClick={() => router.push("/blog")}
            >
              Blog
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
} 