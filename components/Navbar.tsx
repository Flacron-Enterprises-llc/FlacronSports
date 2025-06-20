"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { signOutUser } from "@/lib/firebase-auth";
import dynamic from "next/dynamic";
import UpgradeButton from "./UpgradeButton";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { BadgeCheck } from "lucide-react";
import { usePremium } from "@/lib/contexts/PremiumContext";

// Dynamically import AuthPopup to avoid hydration issues
const AuthPopup = dynamic(() => import("@/components/auth/AuthPopup"), { ssr: false });

export default function Navbar() {
  const router = useRouter();
  const user = useAuthUser();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isPremium, isLoading } = usePremium();

  // Set firebase_id_token cookie when user logs in
  useEffect(() => {
    if (user) {
      user.getIdToken().then(token => {
        document.cookie = `firebase_id_token=${token}; path=/;`;
      });
    }
  }, [user]);

  // Handler for protected routes
  const handleProtectedNav = (path: string, buttonName: string) => {
    if (user) {
      router.push(path);
      setMobileMenuOpen(false);
    } else {
      setPopupMessage(`Login to use this ${buttonName}`);
      setShowPopup(true);
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      router.push('/');
      setMobileMenuOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Dropdown mouse handlers
  const handleDropdownMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsDropdownVisible(true);
  };
  const handleDropdownMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsDropdownVisible(false), 120);
  };

  return (
    <header className="bg-[var(--color-white)] shadow-sm border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <span className="flex items-center cursor-pointer" onClick={() => router.push("/")}>
            <Image src="/logo.png" alt="FlacronSport Logo" width={100} height={100} className="mr-4" />
          </span>
          {/* Hamburger menu button for mobile */}
          <button
            className="md:hidden flex items-center px-3 py-2 border rounded text-[var(--color-primary)] border-[var(--color-primary)] focus:outline-none"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-10">
            {user && (
              <div 
                className="relative group"
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-primary)] font-semibold cursor-pointer">
                    Hi, {user.displayName || user.email?.split('@')[0] || 'User'}!
                  </span>
                  <svg 
                    className="w-4 h-4 text-[var(--color-primary)] transition-transform group-hover:rotate-180" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {isDropdownVisible && (
                  <div 
                    className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                  >
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-[var(--color-primary)] hover:text-white transition-colors flex items-center gap-2"
                    >
                      <svg 
                        className="w-4 h-4" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              className="bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
              onClick={() => router.push("/")}
            >
              Live Scores
            </button>
            <button
              className="bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
              onClick={() => handleProtectedNav("/blog", "Blog")}
            >
              Blog
            </button>
            <button
              className="bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
              onClick={() => handleProtectedNav("/dashboard", "User Dashboard")}
            >
              User Dashboard
            </button>
            {user && !isLoading && (
              isPremium ? (
                <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                  <BadgeCheck className="h-5 w-5 text-yellow-500" /> Premium User
                </span>
              ) : (
              <UpgradeButton customerId={user.uid} />
              )
            )}
          </nav>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 top-20 bg-white border-b border-[var(--color-border)] shadow-lg z-50 animate-fade-in">
            <nav className="flex flex-col items-center space-y-4 py-6">
              {user && (
                <div className="w-full flex flex-col items-center">
                  <span className="text-[var(--color-primary)] font-semibold mb-2">
                    Hi, {user.displayName || user.email?.split('@')[0] || 'User'}!
                  </span>
                  <button
                    onClick={handleLogout}
                    className="w-40 text-left px-4 py-2 text-gray-700 hover:bg-[var(--color-primary)] hover:text-white transition-colors flex items-center gap-2 rounded"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
              <button
                className="w-40 bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
                onClick={() => { router.push("/"); setMobileMenuOpen(false); }}
              >
                Live Scores
              </button>
              <button
                className="w-40 bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
                onClick={() => handleProtectedNav("/blog", "Blog")}
              >
                Blog
              </button>
              <button
                className="w-40 bg-[var(--color-primary)] text-[var(--color-white)] font-semibold px-6 py-2 rounded-full border-none cursor-pointer hover:bg-[var(--color-white)] hover:text-[var(--color-primary)] hover:border hover:border-[var(--color-primary)] transition-colors"
                onClick={() => handleProtectedNav("/dashboard", "User Dashboard")}
              >
                User Dashboard
              </button>
              {user && !isLoading && (
                isPremium ? (
                  <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-semibold w-40 justify-center">
                    <BadgeCheck className="h-5 w-5 text-yellow-500" /> Premium User
                  </span>
                ) : (
                <div className="w-40">
                  <UpgradeButton customerId={user.uid} />
                </div>
                )
              )}
            </nav>
          </div>
        )}
      </div>
      {showPopup && <AuthPopup key="navbar-popup" open={showPopup} onClose={() => setShowPopup(false)} message={popupMessage} />}
    </header>
  );
} 