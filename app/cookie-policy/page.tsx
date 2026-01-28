import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function CookiePolicyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Cookie Policy</CardTitle>
            <p className="text-gray-500">Flacron Enterprises LLC</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="mb-6 text-gray-600">Last updated: <span className="font-semibold">January 1, 2026</span></p>
            
            <p className="mb-6">
              This Cookie Policy explains how Flacron Enterprises LLC uses cookies and similar technologies in our Services.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. What Are Cookies?</h2>
            <p className="mb-4">
              Cookies are small text files stored on your device that help websites and apps function properly and
              improve your experience.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Cookies We Use</h2>
            <p className="mb-2">We may use:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><span className="font-semibold">Essential cookies:</span> required for functionality (login, security)</li>
              <li><span className="font-semibold">Preference cookies:</span> remember settings and choices</li>
              <li><span className="font-semibold">Analytics cookies:</span> help us understand usage and improve performance</li>
              <li><span className="font-semibold">Performance cookies:</span> help prevent crashes and improve speed</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Managing Cookies</h2>
            <p className="mb-4">
              You can control cookies through your browser settings. Disabling cookies may affect functionality.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Third-Party Cookies</h2>
            <p className="mb-4">
              Some third-party services (analytics, advertising, embedded content) may set cookies. We do not control
              their cookies.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Contact</h2>
            <p className="mb-4">
              Email:{" "}
              <a href="mailto:contact@flacronenterprises.com" className="text-blue-600 underline">
                contact@flacronenterprises.com
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
