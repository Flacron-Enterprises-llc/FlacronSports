import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t py-6 mt-12 bg-black text-center text-white text-sm">
      <div className="container mx-auto flex flex-col items-center gap-2">
        <div>
          <Link href="/about" className="hover:underline font-medium text-blue-400">About Us</Link>
          <span className="mx-2 text-gray-500">|</span>
          <Link href="/contact" className="hover:underline font-medium text-blue-400">Contact</Link>
          <span className="mx-2 text-gray-500">|</span>
          <Link href="/privacy-policy" className="hover:underline font-medium text-blue-400">Privacy Policy</Link>
          <span className="mx-2 text-gray-500">|</span>
          <Link href="/terms-of-service" className="hover:underline font-medium text-blue-400">Terms of Service</Link>
        </div>
        <div>
          &copy; {new Date().getFullYear()} FlacronSport Daily. All rights reserved.
        </div>
      </div>
    </footer>
  );
} 