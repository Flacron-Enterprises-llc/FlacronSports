import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-gray-500">Effective date: <span className="font-semibold">[Insert Date]</span></p>
            <p className="mb-4">FlacronSport.com respects your privacy. This page outlines how we collect, use, and protect your data.</p>
            <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>Anonymous usage data (e.g., browser type, device, IP)</li>
              <li>Email addresses (when subscribing to newsletters)</li>
              <li>Preferences like language, region, and sports interests</li>
            </ul>
            <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>To personalize content and send regional newsletters</li>
              <li>To display relevant ads and affiliate offers</li>
              <li>To improve user experience through analytics</li>
            </ul>
            <h2 className="text-xl font-semibold mt-6 mb-2">3. Cookies and Tracking</h2>
            <p className="mb-4">We use cookies and similar technologies from Google AdSense and analytics partners. You can manage cookie preferences in your browser settings.</p>
            <h2 className="text-xl font-semibold mt-6 mb-2">4. Third-Party Tools</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>Google AdSense (ads and tracking)</li>
              <li>Google Gemini</li>
              <li>Firebase</li>
            </ul>
            <h2 className="text-xl font-semibold mt-6 mb-2">5. Your Rights</h2>
            <p className="mb-4">You can request deletion of your data at any time. Contact <a href="mailto:support@flacronsport.com" className="text-blue-600 underline">support@flacronsport.com</a>.</p>
            <p className="mb-2">Learn more: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Ad and Content Network Privacy Policy</a></p>
          </CardContent>
        </Card>
      </main>
    </>
  );
} 