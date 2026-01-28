import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function RefundPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Refund & Cancellation Policy</CardTitle>
            <p className="text-gray-500">Flacron Enterprises LLC</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="mb-6 text-gray-600">Last updated: <span className="font-semibold">January 1, 2026</span></p>
            
            <p className="mb-6">
              This Refund & Cancellation Policy applies to all Flacron Enterprises LLC Services that offer paid
              subscriptions, one-time purchases, or premium features.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Cancellations</h2>
            <p className="mb-2">You can cancel a subscription at any time through:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Your account settings (if available), or</li>
              <li>The platform where you subscribed (Apple App Store / Google Play), or</li>
              <li>
                By contacting support at{" "}
                <a href="mailto:contact@flacronenterprises.com" className="text-blue-600 underline">
                  contact@flacronenterprises.com
                </a>
              </li>
            </ul>
            <p className="mb-4">
              After cancellation, you may continue to access paid features until the end of your billing period unless
              otherwise required by the platform.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">2. Refund Policy</h2>
            <p className="mb-2">Unless required by law, all payments are non-refundable, including:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Subscription fees already billed</li>
              <li>Partial subscription periods</li>
              <li>Unused time or unused features</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Platform-Specific Refunds (Apple/Google)</h2>
            <p className="mb-2">If you subscribed through Apple or Google, refund requests must be handled directly through:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Apple App Store support</li>
              <li>Google Play support</li>
            </ul>
            <p className="mb-4">Their policies may control refund eligibility.</p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">4. Exceptions</h2>
            <p className="mb-2">We may consider refunds only in limited cases such as:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Duplicate charges</li>
              <li>Billing errors directly caused by us</li>
              <li>Proven technical failure preventing access (case-by-case)</li>
            </ul>
            <p className="mb-2">Refund requests must be submitted within 7 days of the charge and include:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Account email</li>
              <li>Transaction ID / receipt</li>
              <li>Reason for the request</li>
            </ul>

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
