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
  const firstMobileButtonRef = useRef<HTMLButtonElement | null>(null);

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
  // Improve mobile menu UX: lock body scroll, focus first item, close on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus first actionable element for accessibility
    firstMobileButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

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
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
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
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)}></div>
            <aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-nav-title"
              className="fixed right-0 top-0 h-full w-5/6 max-w-sm bg-white z-50 shadow-2xl transform transition-transform duration-200 ease-out translate-x-0 flex flex-col"
            >
              <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--color-border)]">
                <h2 id="mobile-nav-title" className="text-base font-semibold text-[var(--color-primary)]">Menu</h2>
                <button
                  aria-label="Close menu"
                  className="p-2 rounded hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
                {user && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">Signed in as</p>
                    <p className="font-semibold text-[var(--color-primary)]">{user.displayName || user.email?.split('@')[0] || 'User'}</p>
                  </div>
                )}
                <button
                  ref={firstMobileButtonRef}
                  className="w-full text-left px-4 py-3 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
                  onClick={() => { router.push('/'); setMobileMenuOpen(false); }}
                >
                  Live Scores
                </button>
                <button
                  className="w-full text-left px-4 py-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => { handleProtectedNav('/blog', 'Blog'); setMobileMenuOpen(false); }}
                >
                  Blog
                </button>
                <button
                  className="w-full text-left px-4 py-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => { handleProtectedNav('/dashboard', 'User Dashboard'); setMobileMenuOpen(false); }}
                >
                  User Dashboard
                </button>
              </nav>
              <div className="px-6 pb-6 pt-3 border-t border-[var(--color-border)]">
                {user && !isLoading ? (
                  isPremium ? (
                    <span className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-semibold justify-center">
                      <BadgeCheck className="h-5 w-5 text-yellow-500" /> Premium User
                    </span>
                  ) : (
                    <UpgradeButton customerId={user.uid} />
                  )
                ) : (
                  <p className="text-xs text-gray-500 text-center">Login to access more features</p>
                )}
                {user && (
                  <button
                    onClick={handleLogout}
                    className="mt-3 w-full text-left px-4 py-2 rounded-lg border text-gray-700 hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
      {showPopup && <AuthPopup key="navbar-popup" open={showPopup} onClose={() => setShowPopup(false)} message={popupMessage} />}
    </header>
  );
} 