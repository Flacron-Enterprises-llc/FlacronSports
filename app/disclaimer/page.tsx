import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function DisclaimerPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Disclaimer</CardTitle>
            <p className="text-gray-500">Flacron Enterprises LLC</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="mb-6 text-gray-600">Last updated: <span className="font-semibold">January 1, 2026</span></p>
            
            <p className="mb-6">
              The content and features provided through our Services are for general informational purposes only.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. No Professional Advice</h2>
            <p className="mb-4">
              We do not provide legal, medical, financial, insurance, or professional advice. Any information or
              AI-generated output should not be treated as a substitute for professional advice.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. AI Output Disclaimer</h2>
            <p className="mb-2">Some features may generate outputs using AI. These outputs:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>May contain errors or inaccuracies</li>
              <li>May not be complete or up to date</li>
              <li>Require user review before use</li>
            </ul>
            <p className="mb-4">
              You are responsible for how you interpret and use AI-generated results.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. External Links</h2>
            <p className="mb-4">
              Our Services may contain links to third-party sites. We are not responsible for their content or practices.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Use at Your Own Risk</h2>
            <p className="mb-4">
              Your use of the Services is at your own risk. We make no warranties regarding outcomes, accuracy, or reliability.
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
