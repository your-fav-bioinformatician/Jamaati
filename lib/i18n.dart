enum Lang { en, ar }

enum AppScreen { splash, profile, quiz, loading, results, feedback }

const List<String> mbtiTypes = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

class NavStrings {
  const NavStrings({required this.langToggle});
  final String langToggle;
}

class Step1Strings {
  const Step1Strings({
    required this.birthDate,
    required this.gender,
    required this.female,
    required this.male,
    required this.city,
    required this.cities,
    required this.religion,
    required this.religions,
    required this.language,
    required this.languages,
    required this.income,
    required this.incomeLevels,
    required this.incomeHelper,
    required this.closeUni,
    required this.useLocation,
  });
  final String birthDate, gender, female, male, city, religion, language, income, incomeHelper, closeUni, useLocation;
  final List<String> cities, religions, languages, incomeLevels;
}

class Step2Strings {
  const Step2Strings({
    required this.gpa,
    required this.gpaHelper,
    required this.track,
    required this.tracks,
    required this.mbti,
    required this.mbtiTypes,
    required this.mbtiHelper,
  });
  final String gpa, gpaHelper, track, mbti, mbtiHelper;
  final List<String> tracks;
  final List<String> mbtiTypes;
}

class PriorityItem {
  const PriorityItem(this.label, this.icon, this.desc);
  final String label, icon, desc;
}

class Step3Strings {
  const Step3Strings({required this.priority, required this.priorities, required this.startQuiz});
  final String priority, startQuiz;
  final List<PriorityItem> priorities;
}

class ProfileMessages {
  const ProfileMessages({
    required this.incomplete,
    required this.gpaInvalid,
    required this.locationNeeded,
    required this.locationUnavailable,
    required this.locationSaved,
    required this.saveFailed,
    required this.saving,
  });
  final String incomplete, gpaInvalid, locationNeeded, locationUnavailable, locationSaved, saveFailed, saving;
}

class ProfileStrings {
  const ProfileStrings({
    required this.steps,
    required this.back,
    required this.next,
    required this.step1,
    required this.step2,
    required this.step3,
    required this.messages,
  });
  final List<String> steps;
  final String back, next;
  final Step1Strings step1;
  final Step2Strings step2;
  final Step3Strings step3;
  final ProfileMessages messages;
}

class QuizStrings {
  const QuizStrings({
    required this.section,
    required this.questionLabel,
    required this.questionTranslations,
    required this.options,
    required this.next,
    required this.finish,
    required this.loadingQuestion,
    required this.loadError,
    required this.submitError,
    required this.retry,
  });
  final String section, questionLabel, next;
  final List<String> options;

  /// Question text keyed by the backend's `concept_vectors` `id` field.
  /// The backend always sends the English text (that's what the scoring
  /// model was built against); this is only consulted for languages other
  /// than English. English can leave this empty, since [translateQuestion]
  /// falls back to whatever the server sent.
  final Map<int, String> questionTranslations;

  /// The question text to display for a question fetched from the server:
  /// the localized version if we have one for this [id], otherwise
  /// [fallback] (the text the backend itself sent).
  String translateQuestion(String fallback, int id) =>
      questionTranslations[id] ?? fallback;

  /// Label for the button on the last question (instead of [next]).
  final String finish;

  /// Shown while a question is being fetched from the server.
  final String loadingQuestion;

  /// Shown when a question couldn't be fetched.
  final String loadError;

  /// Shown when an answer couldn't be submitted.
  final String submitError;

  /// Retry button label for [loadError] / [submitError].
  final String retry;
}

class MatchItem {
  const MatchItem(this.name, this.score, this.desc, this.tags);
  final String name, desc;
  final int score;
  final List<String> tags;
}

class ResultsStrings {
  const ResultsStrings({
    required this.title,
    required this.subtitle,
    required this.bestMatch,
    required this.feedback,
    required this.matches,
    required this.noMatchesTitle, // NEW
    required this.noMatchesDesc,  // NEW
  });
  final String title, subtitle, bestMatch, feedback;
  final String noMatchesTitle, noMatchesDesc;
  final List<MatchItem> matches;
}

class FeedbackStrings {
  const FeedbackStrings({
    required this.title,
    required this.optional,
    required this.submit,
    required this.thankYou,
    required this.thankYouSub,
  });
  final String title, optional, submit, thankYou, thankYouSub;
}

class LandingStrings {
  const LandingStrings({
    required this.quiz,
    required this.articles,
    required this.catalog,
    required this.search,
    required this.comingSoon,
  });

  final String quiz, articles, catalog, search;

  /// Snackbar text for modules that aren't built yet. `{module}` is replaced
  /// with the module's label.
  final String comingSoon;

  /// Display label for a landing-page module id.
  String labelFor(String moduleId) {
    switch (moduleId) {
      case 'quiz':
        return quiz;
      case 'articles':
        return articles;
      case 'catalog':
        return catalog;
      case 'search':
        return search;
      default:
        return moduleId;
    }
  }

  String comingSoonFor(String moduleId) =>
      comingSoon.replaceFirst('{module}', labelFor(moduleId));
}

class AppStrings {
  const AppStrings({
    required this.appName,
    required this.tagline,
    required this.taglineSub,
    required this.splashMsg,
    required this.loading,
    required this.loadingError,
    required this.loadingRetry,
    required this.nav,
    required this.landing,
    required this.profile,
    required this.quiz,
    required this.results,
    required this.feedback,
  });

  final String appName, tagline, taglineSub, splashMsg, loading;

  /// Shown by LoadingScreen's generic error state when its task fails and
  /// the caller hasn't supplied its own `onError` (e.g. the /loading
  /// results fetch). Deliberately task-agnostic — LoadingScreen is reused
  /// for whatever async work a route hands it, not just results.
  final String loadingError;

  /// Retry button label for [loadingError].
  final String loadingRetry;

  final NavStrings nav;
  final LandingStrings landing;
  final ProfileStrings profile;
  final QuizStrings quiz;
  final ResultsStrings results;
  final FeedbackStrings feedback;
}

const AppStrings appStringsEn = AppStrings(
  appName: 'Jaamati',
  tagline: 'Jaamati, My Choice, My Decision.',
  taglineSub: 'A personalized journey to your ideal university program',
  splashMsg: 'Preparing your journey…',
  loading: 'Analyzing your answers…',
  loadingError: 'Something went wrong.',
  loadingRetry: 'Try again',
  nav: NavStrings(langToggle: 'عربي'),
  landing: LandingStrings(
    quiz: 'Quiz',
    articles: 'Articles',
    catalog: 'Catalog',
    search: 'Search',
    comingSoon: '{module} coming soon!',
  ),
  profile: ProfileStrings(
    steps: ['About you', 'Studies', 'Goals'],
    back: 'Back',
    next: 'Next',
    step1: Step1Strings(
      birthDate: 'Date of birth',
      gender: 'Gender',
      female: 'Female',
      male: 'Male',
      city: 'City',
      cities: ['Baghdad', 'Basra', 'Erbil', 'Najaf', 'Mosul', 'Kirkuk', 'Karbala', 'Sulaymaniyah'],
      religion: 'Religion',
      religions: ['Islam (Sunni)', 'Islam (Shia)', 'Christianity', 'Yazidi', 'Mandaean', 'Other'],
      language: 'Primary language',
      languages: ['Arabic', 'Kurdish', 'Turkmen'],
      income: 'Family income',
      incomeLevels: ['Low', 'Medium', 'High'],
      incomeHelper: 'This helps us suggest scholarship opportunities for you.',
      closeUni: 'Prefer universities close to me',
      useLocation: 'Use my location',
    ),
    step2: Step2Strings(
      gpa: 'GPA',
      gpaHelper: 'Enter your high-school grade on a 0–105 scale',
      track: 'High-school track',
      tracks: ['Scientific', 'Literary', 'Arts'],
      mbti: 'MBTI type (optional)',
      mbtiTypes: mbtiTypes,
      mbtiHelper: "Don't know your type? Take a free test →",
    ),
    step3: Step3Strings(
      priority: 'What matters most in your career?',
      priorities: [
        PriorityItem('Profit', '💰', 'Financial security and high earning potential'),
        PriorityItem('Family', '🏠', 'Work-life balance and stability at home'),
        PriorityItem('Dreams', '⭐', 'Following your passion and vision'),
        PriorityItem('Fulfillment', '🌱', 'Making a meaningful difference in the world'),
      ],
      startQuiz: 'Start quiz',
    ),
    messages: ProfileMessages(
      incomplete: 'Please complete all required fields.',
      gpaInvalid: 'Enter a GPA between 0 and 105.',
      locationNeeded: 'Tap "Use my location" or turn off this option.',
      locationUnavailable: "Couldn't get your location. Check your permissions and try again.",
      locationSaved: 'Location saved',
      saveFailed: "Couldn't save your profile. Please try again.",
      saving: 'Saving…',
    ),
  ),
  quiz: QuizStrings(
    section: 'Section 2 · Interests',
    questionLabel: 'Question',
    // The backend sends question text in English already, so there's
    // nothing to translate for this locale.
    questionTranslations: <int, String>{},
    options: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
    next: 'Next',
    finish: 'Finish',
    loadingQuestion: 'Loading your next question…',
    loadError: "Couldn't load the next question. Please try again.",
    submitError: "Couldn't submit your answer. Please try again.",
    retry: 'Try again',
  ),
  results: ResultsStrings(
    title: 'Your top matches',
    subtitle: 'Based on your personality, interests, and academic profile',
    bestMatch: 'Best match',
    feedback: 'Give feedback',
    noMatchesTitle: 'No majors found',
    noMatchesDesc: 'We couldn\'t find any available majors that match your current GPA or other constraints.',
    matches: [
      MatchItem('Computer Engineering', 94,
          'Design and build software and hardware systems that power the modern world.',
          ['Technology', 'Math', 'Innovation']),
      MatchItem('Medicine', 89, 'Heal patients and advance human health through science and compassionate care.',
          ['Science', 'Health', 'Impact']),
      MatchItem('Architecture', 86, 'Create spaces that shape how people live, work, and interact.',
          ['Design', 'Engineering', 'Art']),
      MatchItem('Business Administration', 81,
          'Lead organizations and drive economic growth through strategy and leadership.',
          ['Leadership', 'Economics', 'Strategy']),
      MatchItem('Graphic Design', 78, 'Communicate ideas visually through art, typography, and digital design.',
          ['Art', 'Technology', 'Creativity']),
    ],
  ),
  feedback: FeedbackStrings(
    title: 'How was your experience?',
    optional: 'Any other thoughts? (optional)',
    submit: 'Submit',
    thankYou: 'Thank you for your feedback!',
    thankYouSub: 'Your input helps us improve UniBridge for every student.',
  ),
);

const AppStrings appStringsAr = AppStrings(
  appName: 'جامعتي',
  tagline: 'جامعتي، اختياري، قراري.',
  taglineSub: 'رحلة نحو تخصصك الجامعي الصحيح',
  splashMsg: 'نُعِدّ رحلتك…',
  loading: 'جارٍ تحليل إجاباتك…',
  loadingError: 'حدث خطأ ما.',
  loadingRetry: 'إعادة المحاولة',
  nav: NavStrings(langToggle: 'EN'),
  landing: LandingStrings(
    quiz: 'الاختبار',
    articles: 'المقالات',
    catalog: 'الدليل',
    search: 'بحث',
    comingSoon: '{module} قريباً!',
  ),
  profile: ProfileStrings(
    steps: ['معلوماتك', 'الدراسة', 'أهدافك'],
    back: 'رجوع',
    next: 'التالي',
    step1: Step1Strings(
      birthDate: 'تاريخ الميلاد',
      gender: 'الجنس',
      female: 'أنثى',
      male: 'ذكر',
      city: 'المدينة',
      cities: ['بغداد', 'البصرة', 'أربيل', 'النجف', 'الموصل', 'كركوك', 'كربلاء', 'السليمانية'],
      religion: 'الديانة',
      religions: ['الإسلام (سني)', 'الإسلام (شيعي)', 'المسيحية', 'الإيزيدية', 'المندائية', 'أخرى'],
      language: 'اللغة الأساسية',
      languages: ['العربية', 'الكردية', 'التركمانية'],
      income: 'دخل الأسرة',
      incomeLevels: ['منخفض', 'متوسط', 'مرتفع'],
      incomeHelper: 'يساعدنا ذلك في اقتراح فرص المنح الدراسية المناسبة.',
      closeUni: 'أُفضّل الجامعات القريبة مني',
      useLocation: 'استخدام موقعي',
    ),
    step2: Step2Strings(
      gpa: 'المعدل التراكمي',
      gpaHelper: 'أدخل معدلك الثانوي على مقياس ٠–١٠٥',
      track: 'الفرع الدراسي',
      tracks: ['علمي', 'أدبي', 'فني'],
      mbti: 'نوع شخصيتك MBTI (اختياري)',
      mbtiTypes: mbtiTypes,
      mbtiHelper: '← لا تعرف نوعك؟ خذ الاختبار المجاني',
    ),
    step3: Step3Strings(
      priority: 'ماذا يهمك أكثر في مسيرتك المهنية؟',
      priorities: [
        PriorityItem('الربح', '💰', 'الأمان المالي وإمكانية الكسب المرتفع'),
        PriorityItem('الأسرة', '🏠', 'التوازن بين العمل والحياة والاستقرار'),
        PriorityItem('الأحلام', '⭐', 'اتباع شغفك ورؤيتك'),
        PriorityItem('الرضا', '🌱', 'إحداث فارق حقيقي في العالم'),
      ],
      startQuiz: 'ابدأ الاختبار',
    ),
    messages: ProfileMessages(
      incomplete: 'يرجى إكمال جميع الحقول المطلوبة.',
      gpaInvalid: 'أدخل معدلاً بين ٠ و١٠٥.',
      locationNeeded: 'اضغط «استخدام موقعي» أو أوقف هذا الخيار.',
      locationUnavailable: 'تعذّر تحديد موقعك. تحقق من الأذونات وحاول مرة أخرى.',
      locationSaved: 'تم حفظ الموقع',
      saveFailed: 'تعذّر حفظ ملفك الشخصي. حاول مرة أخرى.',
      saving: 'جارٍ الحفظ…',
    ),
  ),
  quiz: QuizStrings(
    section: 'القسم ٢ · الاهتمامات',
    questionLabel: 'السؤال',
    questionTranslations: <int, String>{
      1: 'أنا بلا شك أميل إلى الرياضيات والعلوم أكثر من ميلي إلى العلوم الإنسانية.',
      2: 'لطالما كان ميلي نحو الفنون والعلوم الإنسانية أكبر من ميلي نحو الرياضيات أو العلوم.',
      3: 'فكرة إنقاذ الأرواح ومساعدة الناس تعني لي كل شيء.',
      4: 'أنا شخص بصري جداً؛ لدي حس فني فطري في الفن والتصميم.',
      5: 'أنا من النوع الذي يحل مسائل الرياضيات من باب المتعة فقط.',
      6: 'ضعني في معطف مختبر مع بعض الماصات وسأكون سعيداً - أحب العمل العملي في المختبر كثيراً.',
      7: 'الناس يسحرونني - أحب اكتشاف ما الذي يجعلنا نتصرف كمجتمع.',
      8: 'لا أطيق فكرة الجلوس محبوساً في مكتب طوال اليوم؛ أحتاج إلى العمل في الهواء الطلق.',
      9: 'أنا مهووس بالتقنية تماماً؛ كل ما يتعلق بالحواسيب يسحرني.',
      10: 'عندما أكون ضمن مجموعة، أجد نفسي أتولى القيادة بشكل طبيعي - وبصراحة، أستمتع بذلك.',
      11: 'عادةً ما أكون "المعالج النفسي" في مجموعة أصدقائي. أحب محاولة فهم كيفية عمل العقل ومساعدة الناس على فهم مشاعرهم.',
      12: 'بصراحة، في نهاية المطاف، كل ما أريده هو مهنة ذات دخل مرتفع.',
      13: 'لا أمانع أبداً المجازفة من أجل شغفي، حتى لو لم يكن سوق العمل خياراً آمناً ومضموناً.',
      14: 'أحتاج إلى التنظيم. لا أتحمّل الفوضى؛ أحب أن يكون أسبوعي مخططاً ومتوقعاً.',
      15: 'أشعر بالملل من فعل الشيء نفسه كل يوم - أحتاج إلى وظيفة تبقيني متيقظاً ومتحفزاً دائماً.',
      16: 'أتألق في بيئة الفريق؛ أفضّل التعاون مع الآخرين على العمل منفرداً.',
      17: 'بصراحة، أنا شخص انطوائي تماماً. كل ما أريده هو وضع سماعاتي والعمل بمفردي تماماً.',
      18: 'لا أمانع الضغط أبداً - في الواقع لا أجد مشكلة في جدول مزدحم وبيئة عمل عالية التوتر.',
      19: 'التحدث أمام الجمهور لا يخيفني إطلاقاً؛ بل أستمتع فعلاً بالوقوف وتقديم العروض.',
      20: 'أكتب طوال الوقت. مذكرات، مقالات، ملاحظات عشوائية - أحب فقط تدوين الكلمات على الورق.',
      21: 'أجد أنه من الممتع جداً الغوص في تفاصيل علم الأحياء ومعرفة كيف تعمل الكائنات الحية بالضبط.',
      22: 'لا شيء يثير حماسي أكثر من النظر عبر المجهر ودراسة اللبنات الصغيرة المكوّنة للحياة.',
      23: 'الفيزياء منطقية جداً بالنسبة لعقلي. أحب استخدام الرياضيات لتفسير كيفية عمل الواقع فعلياً.',
      24: 'أستمتع كثيراً بحل مسائل الفيزياء الصعبة والتفكير في آلية عمل الكون.',
      25: 'الكيمياء تناسبني تماماً - موازنة المعادلات وتوقّع التفاعلات يبدوان لي وكأنهما فطرة ثانية.',
      26: 'أكون في أسعد حالاتي داخل مختبر الكيمياء، أُجري المعايرات وأكتشف بالضبط مما تتكوّن المادة.',
      27: 'يمكنني قضاء ساعات وأنا غارق بسعادة في كتابة الكود أو محاولة حل خوارزمية صعبة.',
      28: 'أنا شغوف جداً ببناء أنظمة البرمجيات والتجريب مع أحدث تقنيات الذكاء الاصطناعي.',
      29: 'أحب التفكير وابتكار أجهزة جديدة في ذهني أو معرفة كيفية بناء الآلات.',
      30: 'أحب بناء الأشياء، سواء كان ذلك بتجميع نموذج أولي سريع أو العبث بمشاريع تقنية بنفسي.',
      31: 'لدي يد ثابتة جداً وأحب القيام بأعمال دقيقة تتطلب تركيزاً عالياً.',
      32: 'لدي حس جمالي فطري - الألوان، التنسيقات، وكيفية تناسق الأشياء معاً.',
      33: 'تعلّم اللغات الجديدة أمر سهل بالنسبة لي؛ أحب تعلّم التحدث بألسنة مختلفة.',
      34: 'أعطني جدول بيانات مليئاً بالأرقام والإحصائيات والرسوم البيانية، وستجدني في عنصري تماماً.',
      35: 'أستمتع فعلاً بالتعمق في الأبحاث العلمية المعقدة لتعلّم مفاهيم جديدة.',
      36: 'أفكر كثيراً في الصواب والخطأ، وآخذ العواقب الأخلاقية لأفعالنا على محمل الجد.',
      37: 'أحب الغرق في تفاصيل الأفكار الكبيرة والمجردة والنظريات والنماذج المعقدة.',
      38: 'أنا بالتأكيد شخص عملي يعتمد على يديه، سواء في إصلاح الأشياء في المنزل أو بناء أشياء من الصفر.',
      39: 'لا أمانع خوض غمار الأوراق الرسمية أو التعامل مع الروتين الإداري إن كان ذلك جزءاً من العمل.',
      40: 'أحتاج إلى أن أعرف أن عملي مهم ويُحدث فرقاً حقيقياً في حياة الناس.',
      41: 'على الأرجح أقضي وقتاً طويلاً جداً في التفكير الوجودي والتساؤل عن معنى الحياة.',
      42: 'يمكنني حرفياً قضاء الليل كله في الحديث عن الفلسفة ومناقشة أسئلة كبيرة لا إجابة لها.',
      43: 'من المثير للاهتمام بالنسبة لي كيف شكّلت الأديان والمعتقدات المختلفة تاريخ البشرية.',
      44: 'أجد أنه من الممتع جداً دراسة النصوص المقدسة ومعرفة كيف تمارس الثقافات المختلفة طقوسها.',
      45: 'أحب التعمق في المعضلات الأخلاقية ومناقشة ما الذي يجعل الناس "أخياراً" أو "أشراراً" فعلاً.',
      46: 'أنظر باستمرار إلى العمارة وأتساءل كيف يتم تخطيط المدن والمباني.',
      47: 'طريقة عمل الكهرباء والدوائر الإلكترونية والإلكترونات تسحرني تماماً.',
      48: 'أنا مهووس بكيفية عمل الآلات - التروس، المحركات، وأي شيء آخر تخطر ببالك.',
      49: 'أي شيء يتعلق بالروبوتات أو الميكاترونكس أو الأتمتة يثير حماسي تماماً.',
      50: 'لدي فضول حقيقي حول مما تتكوّن الأشياء في جوهرها وكيف يمكننا هندسة مواد جديدة.',
      51: 'أعتقد أن الكيمياء الصناعية الضخمة وتحويل المواد الخام إلى منتجات جديدة أمر رائع للغاية.',
      52: 'فكرة بناء تقنيات وأجهزة طبية تُبقي البشر على قيد الحياة فعلياً تبهرني كثيراً.',
      53: 'الصواريخ، الطائرات النفاثة، استكشاف الفضاء - إن كان يطير أو يدور في مدار، فأنا مهتم به تماماً.',
      54: 'أفكر فعلاً كثيراً في كيفية إدارة المدن لأنظمة المياه والنفايات والبيئة.',
      55: 'لوجستيات المصانع الضخمة وخطوط التجميع والأتمتة الصناعية تستهويني حقاً.',
      56: 'أحب النظر إلى الصورة الكبرى للتاريخ - مثل سبب صعود الإمبراطوريات الضخمة وانهيارها في نهاية المطاف.',
      57: 'أنجذب بشدة إلى فك رموز اللغات المندثرة والنصوص القديمة والوثائق التاريخية.',
      58: 'أقضي وقتاً طويلاً في التفكير بالمناطق الرمادية الأخلاقية المعقدة، كما في الطب أو القانون.',
      59: 'أحب مقارنة رؤى العالم المختلفة جنباً إلى جنب - مثل الفلسفة اليونانية مقابل الأديان الشرقية أو علم الكلام الإسلامي - لأرى كيف تتقارن.',
      60: 'يمكنني الجدال حول السياسة والحكومة وكيفية إدارة المجتمع لساعات طويلة.',
    },
    options: ['أرفض تماماً', 'أرفض', 'محايد', 'أوافق', 'أوافق تماماً'],
    next: 'التالي',
    finish: 'إنهاء',
    loadingQuestion: 'جارٍ تحميل سؤالك التالي…',
    loadError: 'تعذّر تحميل السؤال التالي. حاول مرة أخرى.',
    submitError: 'تعذّر إرسال إجابتك. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
  ),
  results: ResultsStrings(
    title: 'أفضل التخصصات لك',
    subtitle: 'بناءً على شخصيتك واهتماماتك وملفك الأكاديمي',
    bestMatch: 'الأنسب لك',
    feedback: 'أعطِ رأيك',
    noMatchesTitle: 'لا توجد تخصصات متاحة',
    noMatchesDesc: 'لم نتمكن من العثور على أي تخصصات متاحة تطابق معدلك التراكمي الحالي أو قيودك الأخرى.',
    matches: [
      MatchItem('هندسة الحاسوب', 94, 'تصميم وبناء أنظمة البرمجيات والأجهزة التي تُشغّل عالمنا الحديث.',
          ['تقنية', 'رياضيات', 'ابتكار']),
      MatchItem('الطب', 89, 'علاج المرضى والنهوض بالصحة البشرية من خلال العلم والرعاية.', ['علوم', 'صحة', 'تأثير']),
      MatchItem('العمارة', 86, 'ابتكار فضاءات تُشكّل طريقة معيشة الناس وتفاعلهم.', ['تصميم', 'هندسة', 'فن']),
      MatchItem('إدارة الأعمال', 81, 'قيادة المنظمات ودفع النمو الاقتصادي عبر الاستراتيجية.',
          ['قيادة', 'اقتصاد', 'استراتيجية']),
      MatchItem('التصميم الجرافيكي', 78, 'التواصل بالأفكار بصرياً من خلال الفن والطباعة والتصميم الرقمي.',
          ['فن', 'تقنية', 'إبداع']),
    ],
  ),
  feedback: FeedbackStrings(
    title: 'كيف كانت تجربتك؟',
    optional: 'أي ملاحظات أخرى؟ (اختياري)',
    submit: 'إرسال',
    thankYou: 'شكراً على ملاحظاتك!',
    thankYouSub: 'مساهمتك تساعدنا على تحسين يونيبريدج لكل طالب.',
  ),
);

AppStrings stringsFor(Lang lang) => lang == Lang.en ? appStringsEn : appStringsAr;