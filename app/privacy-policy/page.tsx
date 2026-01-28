import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-gray-500">Flacron Enterprises LLC</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="mb-4 text-gray-600">Last updated: <span className="font-semibold">January 1, 2026</span></p>
            
            <p className="mb-6">
              Flacron Enterprises LLC ("Flacron," "we," "our," or "us") operates multiple websites, web applications,
              software platforms, and mobile applications (collectively, the "Services"). This Privacy Policy explains how
              we collect, use, disclose, and safeguard information when you access or use any of our Services.
            </p>
            
            <p className="mb-6">
              By using the Services, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
            <p className="mb-4">We may collect the following categories of information:</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">A. Information you provide</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Name, username, and profile information</li>
              <li>Email address and phone number</li>
              <li>Account login credentials (stored securely)</li>
              <li>Messages, requests, or content you submit through the Services</li>
              <li>Customer support communications</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">B. Payment and subscription information</h3>
            <p className="mb-4">
              If you purchase a subscription or make a payment, we may collect billing-related information. Payments
              are typically processed by third-party payment processors (e.g., Stripe, Apple, Google), and we may
              receive transaction status and limited billing details (not full card numbers).
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">C. Automatically collected information</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>IP address and device identifiers</li>
              <li>Browser type, operating system, app version</li>
              <li>Pages/screens viewed, clicks, timestamps, and referring URLs</li>
              <li>Crash logs, diagnostics, and performance data</li>
              <li>Approximate location (derived from IP; not precise GPS unless you grant permission)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">D. Cookies and similar technologies</h3>
            <p className="mb-4">
              We use cookies and similar technologies for functionality, analytics, and preferences. See the Cookie
              Policy for details.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">E. Third-party information</h3>
            <p className="mb-4">
              We may receive information from providers you connect (e.g., "Sign in with Google/Apple") or from
              analytics and advertising partners, where permitted.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="mb-2">We use information to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide, operate, and maintain the Services</li>
              <li>Create and manage user accounts</li>
              <li>Process payments, subscriptions, and transactions</li>
              <li>Improve features, performance, and user experience</li>
              <li>Communicate with you about updates, security notices, and support</li>
              <li>Prevent fraud, abuse, and unauthorized access</li>
              <li>Comply with legal obligations and enforce our terms</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Share Your Information</h2>
            <p className="mb-4 font-semibold">We do not sell your personal information.</p>
            <p className="mb-2">We may share information with:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Service providers (hosting, analytics, email delivery, customer support tools) who help us operate the Services</li>
              <li>Payment processors (for billing and subscription management)</li>
              <li>Legal and compliance when required by law, subpoena, or to protect rights and safety</li>
              <li>Business transfers if we are involved in a merger, acquisition, or sale of assets (you will be notified where required)</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Retention</h2>
            <p className="mb-2">We retain information only as long as necessary to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide the Services</li>
              <li>Meet legal, accounting, or reporting requirements</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="mb-4">You may request deletion where applicable.</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Security</h2>
            <p className="mb-4">
              We use reasonable administrative, technical, and organizational safeguards to protect your information.
              However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">6. Your Privacy Rights</h2>
            <p className="mb-2">Depending on your location, you may have rights to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Object to or restrict certain processing</li>
              <li>Request data portability</li>
            </ul>
            <p className="mb-4">
              To exercise these rights, contact us at{" "}
              <a href="mailto:contact@flacronenterprises.com" className="text-blue-600 underline">
                contact@flacronenterprises.com
              </a>
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">7. Children's Privacy</h2>
            <p className="mb-4">
              Our Services are not directed to children under 13, and we do not knowingly collect personal data from
              children. If you believe a child has provided us personal information, contact us to request deletion.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">8. International Users</h2>
            <p className="mb-4">
              If you access our Services from outside the United States, you understand your information may be
              processed and stored in the United States or other jurisdictions where our service providers operate.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">9. Third-Party Links</h2>
            <p className="mb-4">
              Our Services may include links to third-party websites or services. We are not responsible for the privacy
              practices of those third parties.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. The updated version will be posted with a revised
              "Last updated" date.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Contact Us</h2>
            <p className="mb-2">Flacron Enterprises LLC</p>
            <p className="mb-2">
              Email:{" "}
              <a href="mailto:contact@flacronenterprises.com" className="text-blue-600 underline">
                contact@flacronenterprises.com
              </a>
            </p>
            <p className="mb-4">
              Website:{" "}
              <a href="https://flacronenterprises.com/" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                https://flacronenterprises.com/
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
} 