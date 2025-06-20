"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import TranslateButtonWrapper from '@/components/blog/TranslateButtonWrapper';
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface NewsPost {
  id: string;
  title?: string;
  date: string;
  hook?: string;
  sport?: string;
}

interface SportFilterProps {
  posts: {
    earlyAccess: NewsPost[];
    freeArticles: NewsPost[];
  };
  preferredLanguage: string | null;
  isPremium: boolean;
  userId: string | undefined;
}

const sports = [
  "All", "NFL", "MMA", "Basketball", "Football", "Baseball", "Volleyball", "AFL", "Hockey", "Formula1"
];

export default function SportFilter({ posts, preferredLanguage, isPremium, userId }: SportFilterProps) {
  const [selectedSport, setSelectedSport] = useState('All');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPosts = useMemo(() => {
    const applyFilters = (posts: NewsPost[]) => {
      let filtered = posts;

      if (selectedSport !== 'All') {
        filtered = filtered.filter(post => post.sport && post.sport.toLowerCase() === selectedSport.toLowerCase());
      }
      
      if (selectedDate) {
        const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
        filtered = filtered.filter(post => post.date === formattedSelectedDate);
      }

      if (searchTerm) {
        filtered = filtered.filter(post => post.id.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      
      return filtered;
    };

    return {
      earlyAccess: applyFilters(posts.earlyAccess),
      freeArticles: applyFilters(posts.freeArticles)
    };
  }, [selectedSport, selectedDate, searchTerm, posts]);

  const handleClearFilters = () => {
    setSelectedSport('All');
    setSelectedDate(undefined);
    setSearchTerm('');
  };

  const renderPostCard = (post: NewsPost) => (
    <Card
      key={post.id}
      className="relative bg-[var(--color-white)] border-2 border-[var(--color-primary)] shadow-lg rounded-2xl hover:shadow-xl transition-all duration-200 group overflow-hidden"
      style={{ boxShadow: '0 4px 24px 0 rgba(255,127,0,0.08)' }}
    >
      {post.sport && (
        <div className="absolute top-0 left-0 bg-[var(--color-primary)] text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-br-lg">
          {post.sport}
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-lg leading-tight text-[var(--color-black)] group-hover:text-[var(--color-primary)] transition-colors pt-8">
          {post.title || post.id}
        </CardTitle>
        {post.hook && (
          <p className="text-sm text-[var(--color-gray-mid)] mt-2 line-clamp-3">{post.hook}</p>
        )}
        <div className="text-xs text-[var(--color-gray-mid)] mt-1">
          {post.date ? new Date(post.date).toLocaleDateString() : ""}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {isPremium && preferredLanguage && preferredLanguage !== 'en' && (
            <TranslateButtonWrapper
              postId={post.id}
              language={preferredLanguage}
            />
          )}
          <Button
            className="flex-1 bg-gray-200 text-[var(--color-primary)] font-semibold rounded-full py-2 px-4 shadow border-2 border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all duration-150"
            asChild
          >
            <Link href={`/blog/${encodeURIComponent(post.id)}`}>
              View Original
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
        <Input 
          placeholder="Search by team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-auto"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button onClick={handleClearFilters} variant="ghost">Clear Filters</Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {sports.map(sport => (
          <Button
            key={sport}
            variant={selectedSport === sport ? 'default' : 'outline'}
            onClick={() => setSelectedSport(sport)}
            className="rounded-full"
          >
            {sport}
          </Button>
        ))}
      </div>

      {isPremium && filteredPosts.earlyAccess.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Early Access</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.earlyAccess.map(renderPostCard)}
          </div>
        </div>
      )}

      {filteredPosts.freeArticles.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-gray-dark)] mb-6">Free Articles</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.freeArticles.map(renderPostCard)}
          </div>
        </div>
      )}

      {filteredPosts.earlyAccess.length === 0 && filteredPosts.freeArticles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg text-gray-500">No events yet, stay tuned for more!</p>
        </div>
      )}
    </div>
  );
} 