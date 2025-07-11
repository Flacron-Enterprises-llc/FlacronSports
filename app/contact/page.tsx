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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>General Inquiry</option>
                    <option>Technical Support</option>
                    <option>Partnership Proposal</option>
                    <option>Media Inquiry</option>
                    <option>Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Message
                  </label>
                  <textarea 
                    rows={4} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Please describe your inquiry in detail..."
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Email
                  </label>
                  <input 
                    type="email" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                  />
                </div>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
                  Send Message
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  We typically respond within 24-48 hours during business days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
} 