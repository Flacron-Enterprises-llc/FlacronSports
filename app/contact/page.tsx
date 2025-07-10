import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-lg">
              Have questions, feedback, or partnership inquiries? We’d love to hear from you.
            </p>
            <div className="mb-4">
              <div className="mb-2">
                <span className="font-semibold">Email:</span> <a href="mailto:support@flacronsport.com" className="text-blue-600 underline">support@flacronsport.com</a>
              </div>
              <div className="mb-2">
                <span className="font-semibold">For media inquiries:</span> <a href="mailto:press@flacronsport.com" className="text-blue-600 underline">press@flacronsport.com</a>
              </div>
              <div className="mb-2">
                <span className="font-semibold">For technical support or bug reports:</span> Please describe the issue and include your browser/device info.
              </div>
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-2">Contact Form</h2>
              <p className="mb-4 text-gray-500">(Contact form coming soon.)</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
} 