// Option lists for the quiz intake and the search filters.
//
// Every option has a `value` (exactly what is sent to the backend, the same
// in both languages) and its display labels `en` / `ar`. Screens store the
// value and only ever show the label, so switching language never changes
// what gets sent.

/** Display label of an option in [lang]. */
export const optionLabel = (option, lang) => (lang === 'ar' ? option.ar : option.en ?? option.value);

/** The option with [value] in a flat list or in groups, or undefined. */
export function findOption(listOrGroups, value) {
  for (const item of listOrGroups) {
    if (item.options) {
      const hit = item.options.find((o) => o.value === value);
      if (hit) return hit;
    } else if (item.value === value) {
      return item;
    }
  }
  return undefined;
}

/** True if [value] is one of the options (flat list or groups). */
export const isOption = (listOrGroups, value) => findOption(listOrGroups, value) !== undefined;

// ── gender: sent as "F" / "M" ────────────────────────────────────────────
export const GENDERS = [
  { value: 'F', en: 'Female', ar: 'أنثى' },
  { value: 'M', en: 'Male', ar: 'ذكر' },
];

// ── high-school track: sent as "Sci" / "Lit" / "Arts" ────────────────────
export const TRACKS = [
  { value: 'Sci', en: 'Scientific', ar: 'علمي', icon: '🔬' },
  { value: 'Lit', en: 'Literary', ar: 'ادبي', icon: '📖' },
  { value: 'Arts', en: 'Arts', ar: 'فنون', icon: '🎨' },
];

// ── average monthly family income: sent as "low" / "medium" / "high" ─────
export const INCOME_LEVELS = [
  { value: 'low', en: 'Low: under 1,000,000 IQD', ar: 'منخفض: أقل من ١٬٠٠٠٬٠٠٠ د.ع' },
  { value: 'medium', en: 'Medium: 1,000,000 to 2,000,000 IQD', ar: 'متوسط: من ١٬٠٠٠٬٠٠٠ إلى ٢٬٠٠٠٬٠٠٠ د.ع' },
  { value: 'high', en: 'High: over 2,000,000 IQD', ar: 'مرتفع: أكثر من ٢٬٠٠٠٬٠٠٠ د.ع' },
];

// ── cities of Iraq outside the Kurdistan Region, grouped by governorate.
//    Sent as the English city name. ─────────────────────────────────────
const city = (en, ar) => ({ value: en, en, ar });
export const CITY_GROUPS = [
  { en: 'Baghdad', ar: 'بغداد', options: [city('Baghdad', 'بغداد'), city('Abu Ghraib', 'أبو غريب'), city('Al-Mahmudiyah', 'المحمودية'), city('Al-Tarmiyah', 'الطارمية'), city('Al-Madain', 'المدائن')] },
  { en: 'Basra', ar: 'البصرة', options: [city('Basra', 'البصرة'), city('Al-Zubair', 'الزبير'), city('Abu Al-Khasib', 'أبو الخصيب'), city('Al-Faw', 'الفاو'), city('Al-Qurna', 'القرنة'), city('Shatt Al-Arab', 'شط العرب'), city('Al-Midaina', 'المدينة')] },
  { en: 'Nineveh', ar: 'نينوى', options: [city('Mosul', 'الموصل'), city('Tal Afar', 'تلعفر'), city('Sinjar', 'سنجار'), city('Al-Hamdaniya', 'الحمدانية'), city('Tel Keppe', 'تلكيف'), city('Al-Baaj', 'البعاج'), city('Al-Hadar', 'الحضر')] },
  { en: 'Kirkuk', ar: 'كركوك', options: [city('Kirkuk', 'كركوك'), city('Al-Hawija', 'الحويجة'), city('Daquq', 'داقوق'), city('Al-Dibis', 'الدبس')] },
  { en: 'Anbar', ar: 'الأنبار', options: [city('Ramadi', 'الرمادي'), city('Fallujah', 'الفلوجة'), city('Hit', 'هيت'), city('Haditha', 'حديثة'), city('Al-Qaim', 'القائم'), city('Anah', 'عنة'), city('Rawa', 'راوة'), city('Al-Rutba', 'الرطبة')] },
  { en: 'Babil', ar: 'بابل', options: [city('Hillah', 'الحلة'), city('Al-Musayyib', 'المسيب'), city('Al-Mahawil', 'المحاويل'), city('Al-Hashimiya', 'الهاشمية'), city('Al-Qasim', 'القاسم')] },
  { en: 'Karbala', ar: 'كربلاء', options: [city('Karbala', 'كربلاء'), city('Al-Hindiya', 'الهندية'), city('Ain Al-Tamur', 'عين التمر')] },
  { en: 'Najaf', ar: 'النجف', options: [city('Najaf', 'النجف'), city('Kufa', 'الكوفة'), city('Al-Manathera', 'المناذرة'), city('Al-Mishkhab', 'المشخاب')] },
  { en: 'Al-Qadisiyah', ar: 'القادسية', options: [city('Diwaniyah', 'الديوانية'), city('Afak', 'عفك'), city('Al-Shamiya', 'الشامية'), city('Al-Hamza', 'الحمزة')] },
  { en: 'Wasit', ar: 'واسط', options: [city('Kut', 'الكوت'), city('Al-Suwaira', 'الصويرة'), city('Al-Hay', 'الحي'), city('Al-Numaniyah', 'النعمانية'), city('Al-Aziziyah', 'العزيزية'), city('Badra', 'بدرة')] },
  { en: 'Diyala', ar: 'ديالى', options: [city('Baqubah', 'بعقوبة'), city('Al-Muqdadiyah', 'المقدادية'), city('Khanaqin', 'خانقين'), city('Balad Ruz', 'بلدروز'), city('Al-Khalis', 'الخالص')] },
  { en: 'Salah Al-Din', ar: 'صلاح الدين', options: [city('Tikrit', 'تكريت'), city('Samarra', 'سامراء'), city('Balad', 'بلد'), city('Baiji', 'بيجي'), city('Al-Dour', 'الدور'), city('Al-Shirqat', 'الشرقاط'), city('Tuz Khurmatu', 'طوزخورماتو'), city('Al-Dujail', 'الدجيل')] },
  { en: 'Dhi Qar', ar: 'ذي قار', options: [city('Nasiriyah', 'الناصرية'), city('Al-Shatrah', 'الشطرة'), city('Al-Rifai', 'الرفاعي'), city('Suq Al-Shuyukh', 'سوق الشيوخ'), city('Al-Chibayish', 'الجبايش')] },
  { en: 'Maysan', ar: 'ميسان', options: [city('Amarah', 'العمارة'), city('Al-Majar Al-Kabir', 'المجر الكبير'), city('Qalat Salih', 'قلعة صالح'), city('Ali Al-Gharbi', 'علي الغربي'), city('Al-Maimouna', 'الميمونة')] },
  { en: 'Al-Muthanna', ar: 'المثنى', options: [city('Samawah', 'السماوة'), city('Al-Rumaitha', 'الرميثة'), city('Al-Khidhir', 'الخضر'), city('Al-Salman', 'السلمان')] },
];

// ── religion: sent as the English name ───────────────────────────────────
export const RELIGIONS = [
  { value: 'Islam (Shia)', en: 'Islam (Shia)', ar: 'الإسلام (شيعي)' },
  { value: 'Islam (Sunni)', en: 'Islam (Sunni)', ar: 'الإسلام (سني)' },
  { value: 'Christianity', en: 'Christianity', ar: 'المسيحية' },
  { value: 'Yazidism', en: 'Yazidism', ar: 'الإيزيدية' },
  { value: 'Mandaeism', en: 'Mandaeism (Sabian)', ar: 'المندائية (الصابئة)' },
  { value: 'Yarsanism', en: 'Yarsanism (Kakai)', ar: 'الكاكائية (اليارسانية)' },
  { value: 'Zoroastrianism', en: 'Zoroastrianism', ar: 'الزرادشتية' },
  { value: "Baha'i Faith", en: "Baha'i Faith", ar: 'البهائية' },
  { value: 'Judaism', en: 'Judaism', ar: 'اليهودية' },
  { value: 'Atheism', en: 'Atheism', ar: 'الإلحاد' },
  { value: 'Agnosticism', en: 'Agnosticism', ar: 'اللاأدرية' },
  { value: 'Other', en: 'Other', ar: 'أخرى' },
];

// ── mother tongue: sent as the English name ──────────────────────────────
export const LANGUAGES = [
  { value: 'Arabic', en: 'Arabic', ar: 'العربية' },
  { value: 'Kurdish', en: 'Kurdish', ar: 'الكردية' },
  { value: 'Turkmen', en: 'Turkmen', ar: 'التركمانية' },
  { value: 'Syriac', en: 'Syriac (Assyrian / Chaldean)', ar: 'السريانية (الآشورية / الكلدانية)' },
  { value: 'Armenian', en: 'Armenian', ar: 'الأرمنية' },
  { value: 'Shabaki', en: 'Shabaki', ar: 'الشبكية' },
  { value: 'Mandaic', en: 'Mandaic', ar: 'المندائية' },
  { value: 'Persian', en: 'Persian', ar: 'الفارسية' },
  { value: 'Other', en: 'Other', ar: 'أخرى' },
];

// ── MBTI: sent as the four-letter type ───────────────────────────────────
export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
].map((t) => ({ value: t, en: t, ar: t }));

export const MBTI_TEST_URL = {
  en: 'https://www.16personalities.com/free-personality-test',
  ar: 'https://www.16personalities.com/ar/%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1-%D8%A7%D9%84%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9',
};

// ── career goal: sent as the English label (unchanged from the Flutter app) ──
export const CAREER_GOALS = [
  { value: 'Profit', en: 'Profit', ar: 'الربح', icon: '💰', descEn: 'Financial security and high earning potential', descAr: 'الأمان المالي وإمكانية الكسب المرتفع' },
  { value: 'Family', en: 'Family', ar: 'الأسرة', icon: '🏠', descEn: 'Work-life balance and stability at home', descAr: 'التوازن بين العمل والحياة والاستقرار' },
  { value: 'Dreams', en: 'Dreams', ar: 'الأحلام', icon: '⭐', descEn: 'Following your passion and vision', descAr: 'اتباع شغفك ورؤيتك' },
  { value: 'Fulfillment', en: 'Fulfillment', ar: 'الرضا', icon: '🌱', descEn: 'Making a meaningful difference in the world', descAr: 'إحداث فارق حقيقي في العالم' },
];

// ── quiz answers: the label a user picks → the 1..5 integer /answer takes ──
export const ANSWERS = [
  { value: 1, en: 'Strongly disagree', ar: 'أرفض تماماً' },
  { value: 2, en: 'Disagree', ar: 'أرفض' },
  { value: 3, en: "Don't know", ar: 'لا أعرف' },
  { value: 4, en: 'Agree', ar: 'أوافق' },
  { value: 5, en: 'Strongly agree', ar: 'أوافق تماماً' },
];
