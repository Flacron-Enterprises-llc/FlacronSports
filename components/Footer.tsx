import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-8 border-t border-[var(--color-border)] bg-[var(--color-black)] text-[var(--color-white)] text-center rounded-t-2xl shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4">
        {/* Logo and Brand Section */}
        <div className="flex items-center gap-3 justify-center">
          <img src="/logo.png" alt="FlacronSport Logo" width={40} height={40} className="rounded" />
          <span className="font-bold text-xl tracking-wide">FlacronSport</span>
        </div>
        
        {/* Copyright Section */}
        <div className="text-sm text-[var(--color-gray-mid)]">
          &copy; {new Date().getFullYear()} FlacronSport. All rights reserved.
        </div>
        
        {/* Navigation Links Section */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center text-sm">
          {/* Main Navigation */}
          <div className="flex gap-4">
            <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-[var(--color-primary)] transition-colors">Blog</Link>
            <a href="mailto:contact@flacronsport.com" className="hover:text-[var(--color-primary)] transition-colors">Contact</a>
          </div>
          
          {/* Legal Links */}
          <div className="flex gap-2 text-xs text-gray-400">
            <Link href="/about" className="hover:text-blue-400 transition-colors">About</Link>
            <span className="text-gray-500">|</span>
            <Link href="/privacy-policy" className="hover:text-blue-400 transition-colors">Privacy</Link>
            <span className="text-gray-500">|</span>
            <Link href="/terms-of-service" className="hover:text-blue-400 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
} 