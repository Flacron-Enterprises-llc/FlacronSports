import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto py-12 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">About FlacronSport Daily</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-lg">
              FlacronSport Daily is a fully automated sports media platform that brings you live scores, AI-generated match summaries, and curated daily content — all powered by cutting-edge technology.
            </p>
            <p className="mb-4">
              Our mission is to make sports coverage smarter, faster, and more personalized. Whether you're tracking your favorite league or exploring match insights in your native language, FlacronSport delivers global coverage with local relevance.
            </p>
            <p className="mb-4">
              Built on the latest AI from Google’s Gemini, our platform publishes daily blogs, newsletters, and real-time updates — with no manual input required.
            </p>
            <h2 className="text-2xl font-semibold mt-8 mb-2">Our Vision:</h2>
            <ul className="list-disc pl-6 mb-4">
              <li>Real-time, multilingual sports content</li>
              <li>Regional insights and alerts for fans worldwide</li>
              <li>Ad-free premium experiences for serious fans</li>
            </ul>
            <p className="mt-6">
              Want to partner or collaborate? Reach out via our <a href="/contact" className="text-blue-600 underline">Contact Page</a>.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
} 