"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { getAuth } from "firebase/auth";
import { usePremium } from "@/lib/contexts/PremiumContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, AlertTriangle } from "lucide-react";

const LEAGUES = [
  { code: "nba", name: "NBA" },
  { code: "nfl", name: "NFL" },
  { code: "afl", name: "AFL" },
  { code: "f1", name: "Formula 1" },
  { code: "mma", name: "MMA" },
  { code: "football", name: "Football" },
  { code: "baseball", name: "Baseball" },
  { code: "hockey", name: "Hockey" },
  { code: "rugby", name: "Rugby" },
  { code: "basketball", name: "Basketball" },
  { code: "volleyball", name: "Volleyball" },
];

const REGIONS = [
  { code: "us", name: "United States" },
  { code: "eu", name: "Europe" },
  { code: "asia", name: "Asia" },
  { code: "oceania", name: "Oceania" },
  { code: "africa", name: "Africa" },
  { code: "sa", name: "South America" },
];

// ISO 639-1 language codes and names
const LANGUAGES = [
  { code: "en", name: "English" }, { code: "es", name: "Spanish" }, { code: "fr", name: "French" }, { code: "de", name: "German" }, { code: "zh", name: "Chinese" }, { code: "ar", name: "Arabic" }, { code: "ru", name: "Russian" }, { code: "pt", name: "Portuguese" }, { code: "hi", name: "Hindi" }, { code: "ja", name: "Japanese" }, { code: "it", name: "Italian" }, { code: "ko", name: "Korean" }, { code: "tr", name: "Turkish" }, { code: "nl", name: "Dutch" }, { code: "sv", name: "Swedish" }, { code: "pl", name: "Polish" }, { code: "uk", name: "Ukrainian" }, { code: "fa", name: "Persian" }, { code: "he", name: "Hebrew" }, { code: "id", name: "Indonesian" }, { code: "th", name: "Thai" }, { code: "vi", name: "Vietnamese" }, { code: "cs", name: "Czech" }, { code: "el", name: "Greek" }, { code: "ro", name: "Romanian" }, { code: "hu", name: "Hungarian" }, { code: "da", name: "Danish" }, { code: "fi", name: "Finnish" }, { code: "no", name: "Norwegian" }, { code: "sk", name: "Slovak" }, { code: "bg", name: "Bulgarian" }, { code: "hr", name: "Croatian" }, { code: "sr", name: "Serbian" }, { code: "lt", name: "Lithuanian" }, { code: "sl", name: "Slovenian" }, { code: "et", name: "Estonian" }, { code: "lv", name: "Latvian" }, { code: "ms", name: "Malay" }, { code: "bn", name: "Bengali" }, { code: "ta", name: "Tamil" }, { code: "te", name: "Telugu" }, { code: "ml", name: "Malayalam" }, { code: "ur", name: "Urdu" }, { code: "sw", name: "Swahili" }, { code: "zu", name: "Zulu" }, { code: "af", name: "Afrikaans" }, { code: "sq", name: "Albanian" }, { code: "ca", name: "Catalan" }, { code: "eu", name: "Basque" }, { code: "gl", name: "Galician" }, { code: "is", name: "Icelandic" }, { code: "mk", name: "Macedonian" }, { code: "mt", name: "Maltese" }, { code: "ga", name: "Irish" }, { code: "cy", name: "Welsh" }, { code: "be", name: "Belarusian" }, { code: "az", name: "Azerbaijani" }, { code: "ka", name: "Georgian" }, { code: "hy", name: "Armenian" }, { code: "kk", name: "Kazakh" }, { code: "uz", name: "Uzbek" }, { code: "mn", name: "Mongolian" }, { code: "lo", name: "Lao" }, { code: "km", name: "Khmer" }, { code: "my", name: "Burmese" }, { code: "si", name: "Sinhala" }, { code: "am", name: "Amharic" }, { code: "yo", name: "Yoruba" }, { code: "ig", name: "Igbo" }, { code: "ha", name: "Hausa" }, { code: "so", name: "Somali" }, { code: "ne", name: "Nepali" }, { code: "ps", name: "Pashto" }, { code: "pa", name: "Punjabi" }, { code: "gu", name: "Gujarati" }, { code: "or", name: "Odia" }, { code: "as", name: "Assamese" }, { code: "mr", name: "Marathi" }, { code: "sa", name: "Sanskrit" }, { code: "kn", name: "Kannada" }
];

export default function UserDashboard() {
  const [leagues, setLeagues] = useState<string[]>([]);
  const [region, setRegion] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [newsletterEnabled, setNewsletterEnabled] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubscribeMessage, setUnsubscribeMessage] = useState<string | null>(null);
  const { isPremium, isLoading } = usePremium();

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user?.email) {
          setUserEmail(user.email);
          
          // Load dashboard settings from the new collection
          const response = await fetch(`/api/get-dashboard-settings?email=${encodeURIComponent(user.email)}`);
          const data = await response.json();
          
          if (data.success) {
            setLeagues(data.settings.leagues || []);
            setRegion(data.settings.region || "");
            setLanguage(data.settings.language || "");
            setNewsletterEnabled(data.settings.newsletterEnabled || false);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, []);

  async function handleSave(e: any) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    // Validation
    if (leagues.length === 0) {
      setError("Please select at least one league."); setSaving(false); return;
    }
    if (!region) {
      setError("Please select a region."); setSaving(false); return;
    }
    if (!language) {
      setError("Please select a language."); setSaving(false); return;
    }

    // Get current user
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to save settings."); setSaving(false); return;
    }

    // Save to API route
    try {
      const res = await fetch("/api/save-dashboard-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          leagues,
          region,
          language,
          newsletterEnabled,
          userEmail: user.email || userEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save settings. Please try again.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err: any) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleLeagueChange(code: string) {
    setLeagues((prev: string[]) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const handleUnsubscribe = async () => {
    if (!confirm("Are you sure you want to cancel your premium subscription? You'll lose access to premium features at the end of your current billing period.")) {
      return;
    }

    try {
      setUnsubscribing(true);
      setError(null);
      
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError("You must be logged in to cancel your subscription.");
        return;
      }

      const response = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to cancel subscription. Please try again.");
      } else {
        // Handle both successful cancellation and the case where there's payment but no subscription
        if (data.note) {
          setUnsubscribeMessage(data.message);
        } else {
          setUnsubscribeMessage("Your subscription has been canceled. You'll continue to have premium access until the end of your current billing period.");
        }
        setTimeout(() => setUnsubscribeMessage(null), 5000);
      }
    } catch (err) {
      setError("Failed to cancel subscription. Please try again.");
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-2xl mx-auto my-10 p-6 bg-white rounded-xl shadow border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-primary)]">User Dashboard</h1>
              {!isLoading && isPremium && (
                <div className="flex items-center gap-3">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <BadgeCheck className="h-4 w-4 mr-1" />
                    Premium User
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnsubscribe}
                    disabled={unsubscribing}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {unsubscribing ? "Canceling..." : "Cancel Subscription"}
                  </Button>
                </div>
              )}
            </div>

            {unsubscribeMessage && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-yellow-800">{unsubscribeMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* Preferred Leagues */}
              <div>
                <label className="block font-semibold mb-2 text-gray-700">Preferred Leagues</label>
                <div className="flex flex-wrap gap-3">
                  {LEAGUES.map((l) => (
                    <label key={l.code} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${leagues.includes(l.code) ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                      <input
                        type="checkbox"
                        checked={leagues.includes(l.code)}
                        onChange={() => handleLeagueChange(l.code)}
                        className="accent-[var(--color-primary)]"
                      />
                      {l.name}
                    </label>
                  ))}
                </div>
              </div>
              {/* Region */}
              <div>
                <label className="block font-semibold mb-2 text-gray-700">Region</label>
                <select
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  required
                >
                  <option value="">Select region</option>
                  {REGIONS.map((r) => (
                    <option key={r.code} value={r.code}>{r.name}</option>
                  ))}
                </select>
              </div>
              {/* Language */}
              <div>
                <label className="block font-semibold mb-2 text-gray-700">Language</label>
                <select
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  required
                >
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>
              {/* Newsletter Subscription */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <label className="block font-semibold mb-4 text-gray-700">Newsletter Subscription</label>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-gray-600 mb-1">Stay updated with the latest sports news and updates</p>
                    <p className="text-sm text-gray-500">Receive weekly newsletters with curated content</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                      checked={newsletterEnabled}
                      onChange={() => setNewsletterEnabled((v) => !v)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold py-2 px-6 rounded-lg transition-colors"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              {error && <div className="text-red-600 font-semibold">{error}</div>}
              {saved && <div className="text-green-600 font-semibold">Settings saved!</div>}
            </form>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 