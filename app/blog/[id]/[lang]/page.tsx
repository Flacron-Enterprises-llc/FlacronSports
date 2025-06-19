import { notFound } from 'next/navigation';
import { translateContent } from '@/lib/gemini';
import { getDb } from "@/lib/firebase-config";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    const content = typeof data.content === "string"
      ? JSON.parse(data.content.replace(/^```json/, "").replace(/```$/, "").trim())
      : data.content;

    return {
      id: doc.id,
      ...content
    };
  } catch {
    return null;
  }
}

export default async function BlogPost({ params }: { params: { id: string; lang: string } }) {
  const { id, lang } = params;
  
  // Check if language is supported
  if (!(lang in LANGUAGES)) {
    notFound();
  }
  
  // Get the blog post
  const post = await getBlogPost(id);
  if (!post) {
    notFound();
  }

  let title = post.title;
  let headings = post.headings;

  // Translate content if not English
  if (lang !== 'en') {
    try {
      // Translate title
      title = await translateContent(title, LANGUAGES[lang as LanguageCode]);

      // Translate each section
      headings = await Promise.all(
        post.headings.map(async (section: any) => ({
          heading: await translateContent(section.heading, LANGUAGES[lang as LanguageCode]),
          content: await translateContent(section.content, LANGUAGES[lang as LanguageCode])
        }))
      );
    } catch (error) {
      console.error('Translation failed:', error);
      // If translation fails, fall back to original content
      title = post.title;
      headings = post.headings;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            <div className="text-xs text-gray-500 mt-1">
              {post.date ? new Date(post.date).toLocaleDateString() : ""}
            </div>
          </CardHeader>
          <CardContent>
            {headings?.map((section: any, idx: number) => (
              <section key={idx} className="mb-6">
                <h2 className="text-xl font-semibold mb-2">{section.heading}</h2>
                <p className="text-base text-gray-800">{section.content}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 