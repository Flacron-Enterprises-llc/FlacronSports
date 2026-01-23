import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization of Gemini API to avoid build-time errors
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is required');
    }
    console.log('Using API Key:', `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// Cache for storing translations
const translationCache = new Map<string, string>();

// Generate a cache key for the content and language
function getCacheKey(content: string, language: string): string {
  return `${content}-${language}`;
}

export async function translateContent(content: string, targetLanguage: string): Promise<string> {
  try {
    // Check cache first
    const cacheKey = getCacheKey(content, targetLanguage);
    const cachedTranslation = translationCache.get(cacheKey);
    
    if (cachedTranslation) {
      console.log('Using cached translation for:', targetLanguage);
      return cachedTranslation;
    }

    const genAIInstance = getGenAI();
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('Using Gemini 2.0 Flash model');

    const prompt = `Translate the following text to ${targetLanguage}. Maintain the original formatting and structure, including any HTML tags or markdown. Only return the translated text without any additional explanations:

${content}`;

    console.log('Sending translation request for language:', targetLanguage);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text();
    
    // Store in cache
    translationCache.set(cacheKey, translatedText);
    console.log('Translation cached for:', targetLanguage);
    
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Failed to translate content');
  }
} 