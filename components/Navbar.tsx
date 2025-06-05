"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Navbar() {
  const router = useRouter();
  return (
    <header className="bg-[var(--color-white)] shadow-sm border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <span className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
            <Image src="/logo.png" alt="FlacronSport Logo" width={100} height={100} className="mr-4" />
          </span>
          <nav className="hidden md:flex space-x-10">
            <button
              className="bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
              onClick={() => router.push("/")}
            >
              Live Scores
            </button>
            <button
              className="bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
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