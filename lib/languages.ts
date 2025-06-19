export const supportedLanguages = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
} as const;

export type LanguageCode = keyof typeof supportedLanguages;

export function isValidLanguage(lang: string): lang is LanguageCode {
  return lang in supportedLanguages;
} 