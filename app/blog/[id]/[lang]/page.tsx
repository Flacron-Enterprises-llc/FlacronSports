import { notFound } from 'next/navigation';
import { translateContent } from '@/lib/gemini';
import { getDb } from "@/lib/firebase-config";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// All ISO 639-1 language codes and names
const LANGUAGES = {
  // A
  aa: 'Afar', ab: 'Abkhazian', af: 'Afrikaans', ak: 'Akan', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', an: 'Aragonese', hy: 'Armenian', as: 'Assamese', av: 'Avaric', ay: 'Aymara', az: 'Azerbaijani',
  // B
  ba: 'Bashkir', bm: 'Bambara', be: 'Belarusian', bn: 'Bengali', bh: 'Bihari', bi: 'Bislama', bs: 'Bosnian', br: 'Breton', bg: 'Bulgarian',
  // C
  ca: 'Catalan', ch: 'Chamorro', ce: 'Chechen', ny: 'Chichewa', zh: 'Chinese', cv: 'Chuvash', kw: 'Cornish', co: 'Corsican', cr: 'Cree', hr: 'Croatian', cs: 'Czech',
  // D
  da: 'Danish', dv: 'Divehi', nl: 'Dutch', dz: 'Dzongkha',
  // E
  en: 'English', eo: 'Esperanto', et: 'Estonian', ee: 'Ewe',
  // F
  fo: 'Faroese', fj: 'Fijian', fi: 'Finnish', fr: 'French', fy: 'Western Frisian', ff: 'Fulah',
  // G
  gd: 'Gaelic', gl: 'Galician', lg: 'Ganda', ka: 'Georgian', de: 'German', el: 'Greek', kl: 'Kalaallisut', gn: 'Guarani', gu: 'Gujarati',
  // H
  ht: 'Haitian', ha: 'Hausa', he: 'Hebrew', hz: 'Herero', hi: 'Hindi', ho: 'Hiri Motu', hu: 'Hungarian',
  // I
  is: 'Icelandic', io: 'Ido', ig: 'Igbo', id: 'Indonesian', ia: 'Interlingua', ie: 'Interlingue', iu: 'Inuktitut', ik: 'Inupiaq', ga: 'Irish', it: 'Italian',
  // J
  ja: 'Japanese', jv: 'Javanese',
  // K
  kn: 'Kannada', kr: 'Kanuri', ks: 'Kashmiri', kk: 'Kazakh', km: 'Central Khmer', ki: 'Kikuyu', rw: 'Kinyarwanda', ky: 'Kirghiz', kv: 'Komi', kg: 'Kongo', ko: 'Korean', ku: 'Kurdish', kj: 'Kuanyama',
  // L
  lo: 'Lao', la: 'Latin', lv: 'Latvian', li: 'Limburgan', ln: 'Lingala', lt: 'Lithuanian', lu: 'Luba-Katanga', lb: 'Luxembourgish',
  // M
  mk: 'Macedonian', mg: 'Malagasy', ms: 'Malay', ml: 'Malayalam', mt: 'Maltese', mi: 'Maori', mr: 'Marathi', mh: 'Marshallese', mn: 'Mongolian',
  // N
  na: 'Nauru', nv: 'Navajo', nd: 'North Ndebele', ne: 'Nepali', ng: 'Ndonga', nb: 'Norwegian Bokmål', nn: 'Norwegian Nynorsk',
  // O
  oc: 'Occitan', oj: 'Ojibwa', or: 'Oriya', om: 'Oromo', os: 'Ossetian',
  // P
  pi: 'Pali', ps: 'Pashto', fa: 'Persian', pl: 'Polish', pt: 'Portuguese', pa: 'Punjabi',
  // Q
  qu: 'Quechua',
  // R
  ro: 'Romanian', rm: 'Romansh', rn: 'Rundi', ru: 'Russian',
  // S
  sm: 'Samoan', sg: 'Sango', sa: 'Sanskrit', sc: 'Sardinian', sr: 'Serbian', sn: 'Shona', ii: 'Sichuan Yi', sd: 'Sindhi', si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian', so: 'Somali', st: 'Southern Sotho', es: 'Spanish', su: 'Sundanese', sw: 'Swahili', ss: 'Swati', sv: 'Swedish',
  // T
  tl: 'Tagalog', ty: 'Tahitian', tg: 'Tajik', ta: 'Tamil', tt: 'Tatar', te: 'Telugu', th: 'Thai', bo: 'Tibetan', ti: 'Tigrinya', to: 'Tonga', ts: 'Tsonga', tn: 'Tswana', tk: 'Turkmen', tw: 'Twi',
  // U
  ug: 'Uighur', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek',
  // V
  ve: 'Venda', vi: 'Vietnamese', vo: 'Volapük',
  // W
  wa: 'Walloon', cy: 'Welsh', wo: 'Wolof',
  // X
  xh: 'Xhosa',
  // Y
  yi: 'Yiddish', yo: 'Yoruba',
  // Z
  za: 'Zhuang', zu: 'Zulu'
} as const;

type LanguageCode = keyof typeof LANGUAGES;

async function getBlogPost(id: string) {
  const db = getDb();
  const doc = await db.collection("articles").doc(id).get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;

  try {
    let articleData: any;
    if (data.content && typeof data.content === 'string') {
        articleData = JSON.parse(data.content.replace(/^```json/, "").replace(/```$/, "").trim());
    } else {
        articleData = data;
    }

    return {
      id: doc.id,
      ...articleData,
      title: articleData?.matchData?.title || articleData?.title
    };
  } catch {
    return null;
  }
}

export default async function BlogPost({ params }: { params: { id: string; lang: string } }) {
  const { id, lang } = params;
  
  // Decode the document ID to handle spaces and special characters
  const decodedId = decodeURIComponent(id);
  
  // Check if language is supported
  if (!(lang in LANGUAGES)) {
    notFound();
  }
  
  // Get the blog post
  const post = await getBlogPost(decodedId);
  if (!post) {
    notFound();
  }

  const article = post.matchData || post;
  const targetLanguage = LANGUAGES[lang as LanguageCode];
  
  let translatedArticle = { ...article };

  // Translate content if not English
  if (lang !== 'en') {
    try {
      const [title, headline, hook, details, summary, keyMoments] = await Promise.all([
        translateContent(article.title, targetLanguage),
        translateContent(article.headline, targetLanguage),
        translateContent(article.hook, targetLanguage),
        translateContent(article.details, targetLanguage),
        translateContent(article.summary, targetLanguage),
        Promise.all(article.keyMoments.map((moment: string) => translateContent(moment, targetLanguage)))
      ]);
      translatedArticle = { ...article, title, headline, hook, details, summary, keyMoments };
    } catch (error) {
      console.error('Translation failed:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            {translatedArticle.sport && (
              <div className="text-center mb-4">
                <Badge variant="secondary" className="uppercase tracking-wider text-sm font-semibold">{translatedArticle.sport}</Badge>
              </div>
            )}
            <CardTitle className="text-3xl font-bold text-center mb-2">{translatedArticle.title || id}</CardTitle>
            <p className="text-xl text-gray-600 text-center">{translatedArticle.headline}</p>
            <div className="text-sm text-gray-500 mt-2 text-center">
              {translatedArticle.date ? new Date(translatedArticle.date).toLocaleDateString() : ""}
            </div>
            {translatedArticle.stats && translatedArticle.stats.teamA && translatedArticle.stats.teamB && (
              <p className="text-md text-gray-600 text-center mt-1">{translatedArticle.stats.teamA} vs {translatedArticle.stats.teamB}</p>
            )}
          </CardHeader>
          <CardContent className="prose max-w-none">
            {translatedArticle.hook && (
              <p className="text-lg font-semibold italic text-gray-700 my-4 text-center">{translatedArticle.hook}</p>
            )}
            <p className="lead">{translatedArticle.details}</p>
            
            {translatedArticle.stats && (
              <div className="my-8 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-xl font-bold mb-4 text-center">Match Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="font-bold text-lg">{translatedArticle.stats.teamA}</p>
                    <p className="text-3xl font-bold">{translatedArticle.stats.scoreA}</p>
                  </div>
                  <div>
                    <p className="font-bold text-lg">{translatedArticle.stats.teamB}</p>
                    <p className="text-3xl font-bold">{translatedArticle.stats.scoreB}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-4 text-center">
                  <p>Competition: {translatedArticle.stats.competition}</p>
                </div>
              </div>
            )}

            {translatedArticle.keyMoments && translatedArticle.keyMoments.length > 0 && (
              <div className="my-8">
                <h3 className="text-xl font-bold mb-4">Key Moments</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {translatedArticle.keyMoments.map((moment: string, idx: number) => (
                    <li key={idx}>{moment}</li>
                  ))}
                </ol>
              </div>
            )}
            
            {translatedArticle.summary && (
              <div className="my-8">
                <h3 className="text-xl font-bold mb-4">Summary</h3>
                <blockquote className="p-4 bg-gray-100 border-l-4 border-gray-500 text-gray-600 italic">
                  <p>{translatedArticle.summary}</p>
                </blockquote>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 