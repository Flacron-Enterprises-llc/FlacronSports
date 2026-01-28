import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function TermsOfServicePage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Terms & Conditions</CardTitle>
            <p className="text-gray-500">Flacron Enterprises LLC</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="mb-6 text-gray-600">Last updated: <span className="font-semibold">January 1, 2026</span></p>
            
            <p className="mb-6">
              These Terms & Conditions ("Terms") govern your access to and use of our websites, web apps, mobile
              apps, and related services (collectively, the "Services") operated by Flacron Enterprises LLC ("Flacron,"
              "we," "our," or "us").
            </p>
            
            <p className="mb-6 font-semibold">By accessing or using the Services, you agree to these Terms.</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Eligibility</h2>
            <p className="mb-4">
              You must be at least 13 years old (or older if required in your jurisdiction) to use the Services.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Accounts</h2>
            <p className="mb-2">You may be required to create an account. You agree to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide accurate information</li>
              <li>Keep your credentials secure</li>
              <li>Notify us of unauthorized access</li>
            </ul>
            <p className="mb-4">You are responsible for activity under your account.</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Acceptable Use</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Use the Services for illegal activity</li>
              <li>Attempt to hack, disrupt, reverse engineer, or misuse the Services</li>
              <li>Upload malware or harmful code</li>
              <li>Infringe intellectual property rights</li>
              <li>Harass, abuse, or harm others</li>
            </ul>
            <p className="mb-4">We may suspend or terminate access for violations.</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Subscriptions & Payments</h2>
            <p className="mb-2">If the Services include paid plans:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Prices and billing cycles are shown at purchase</li>
              <li>Subscriptions may auto-renew unless canceled</li>
              <li>Taxes may apply depending on your location</li>
            </ul>
            <p className="mb-4">Payments may be handled by third-party processors (Apple, Google, Stripe, etc.).</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">5. AI Features and Outputs</h2>
            <p className="mb-2">
              Some Services may use artificial intelligence to generate suggestions, content, or automated outputs ("AI
              Outputs"). You understand:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>AI Outputs may be inaccurate, incomplete, or inappropriate</li>
              <li>You are responsible for verifying outputs before relying on them</li>
              <li>AI Outputs are not professional advice (legal, medical, financial, etc.)</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Intellectual Property</h2>
            <p className="mb-4">
              All rights, title, and interest in the Services (software, designs, logos, trademarks, content) are owned by
              Flacron or its licensors. You may not copy, distribute, or create derivative works without permission.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">7. User Content</h2>
            <p className="mb-4">
              If you submit content to the Services ("User Content"), you grant us a worldwide, non-exclusive license to
              host, store, reproduce, and display it solely to operate and improve the Services. You represent you have
              the rights to submit such content.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Service Availability</h2>
            <p className="mb-4">
              We strive to keep the Services available but do not guarantee uninterrupted access. We may modify or
              discontinue features at any time.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Disclaimer of Warranties</h2>
            <p className="mb-4">
              The Services are provided "AS IS" and "AS AVAILABLE," without warranties of any kind, express or implied.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Limitation of Liability</h2>
            <p className="mb-4">
              To the maximum extent permitted by law, Flacron is not liable for indirect, incidental, consequential,
              special, or punitive damages, or any loss of profits, revenue, data, or goodwill arising from your use of the
              Services.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Termination</h2>
            <p className="mb-4">
              We may suspend or terminate your access at any time if you violate these Terms. You may stop using the
              Services at any time.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">12. Governing Law</h2>
            <p className="mb-4">
              These Terms are governed by the laws of the United States, without regard to conflict-of-law principles.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">13. Contact</h2>
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