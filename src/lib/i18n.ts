/**
 * Centralized i18n for Kissan AI.
 *
 * Two languages: English (`en`, default) and Urdu (`ur`, RTL).
 * The dictionary is grouped by feature area. Keys not found in the active
 * language fall back to English, so partial translations never break the UI.
 */

export type Language = "en" | "ur";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
];

type Dict = Record<string, string>;

const en: Dict = {
  /* ---------- Brand ---------- */
  "brand.name": "Kissan AI",
  "brand.tagline": "Your AI Farming Decision Assistant",

  /* ---------- Landing nav ---------- */
  "nav.home": "Home",
  "nav.features": "Features",
  "nav.howItWorks": "How It Works",
  "nav.problem": "Problem",
  "nav.solution": "Solution",
  "nav.about": "About",
  "nav.faq": "FAQ",
  "nav.contact": "Contact",
  "nav.login": "Login",
  "nav.getStarted": "Get Started",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.main": "Main",
  "nav.primary": "Primary",
  "nav.aiTools": "AI Tools",
  "nav.manage": "Manage",
  "nav.bottom": "Bottom",
  "nav.more": "More",

  /* ---------- App nav (sidebar / drawer / bottom bar) ---------- */
  "app.nav.dashboard": "Dashboard",
  "app.nav.cropDoctor": "Crop Doctor",
  "app.nav.assistant": "Assistant",
  "app.nav.voice": "Voice",
  "app.nav.weather": "Weather",
  "app.nav.todayActions": "Today's Actions",
  "app.nav.farmProfile": "Farm Profile",
  "app.nav.risksAlerts": "Risks & Alerts",
  "app.nav.yieldPrediction": "Yield Prediction",
  "app.nav.cropRecommendation": "Crop Recommendation",
  "app.nav.diagnosisHistory": "Diagnosis History",
  "app.nav.chatHistory": "Chat History",
  "app.nav.noFarm": "No farm set up yet",

  /* ---------- Common UI ---------- */
  "common.loading": "Loading…",
  "common.loadingFarm": "Loading your farm…",
  "common.retry": "Try again",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.search": "Search",
  "common.noResults": "No results",
  "common.today": "Today",
  "common.language": "Language",
  "common.theme": "Theme",
  "common.light": "Light",
  "common.dark": "Dark",
  "common.error": "Something went wrong",
  "common.optional": "Optional",

  /* ---------- Landing: hero ---------- */
  "hero.badge": "Your AI Farming Decision Assistant",
  "hero.titleA": "Understand your farm.",
  "hero.titleB": "Know what to do today.",
  "hero.subtitle":
    "Kissan AI connects your farm's crops, weather, risks, and expected yield into one clear picture — with plain, actionable guidance in your language.",
  "hero.cta": "Create Your Farm",
  "hero.explore": "Explore Dashboard",
  "hero.h1": "Farm-centric",
  "hero.h1Text":
    "Guidance tailored to your crops, soil, and location — not generic advice.",
  "hero.h2": "Spot problems early",
  "hero.h2Text":
    "Upload a photo of a sick leaf and understand what may be happening.",
  "hero.h3": "Ask in your language",
  "hero.h3Text": "Talk or type in Urdu, English, Punjabi, and more.",

  /* ---------- Landing: problem ---------- */
  "problem.eyebrow": "The Problem",
  "problem.title": "Farming is full of uncertainty",
  "problem.subtitle":
    "Smallholder farmers make life-critical decisions every day — but often with scattered, outdated, or generic information.",
  "problem.p1": "Unpredictable weather",
  "problem.p1Text":
    "Rain, heat, and frost arrive without warning, leaving farmers guessing when to plant, water, or harvest.",
  "problem.p2": "Pests and disease spread fast",
  "problem.p2Text":
    "By the time symptoms are visible, damage is often done. Early detection is the difference between saving and losing a crop.",
  "problem.p3": "Advice isn't local",
  "problem.p3Text":
    "Generic tips ignore your soil, your crop, your climate, and your calendar — so most advice simply doesn't apply to your farm.",
  "problem.p4": "Too many decisions, too little time",
  "problem.p4Text":
    "Between inputs, weather, and daily farm work, it's hard to know what actually matters today.",

  /* ---------- Landing: solution ---------- */
  "solution.eyebrow": "The Solution",
  "solution.title": "One clear picture of your farm — and what to do today",
  "solution.subtitle":
    "Kissan AI is a farm-centric decision engine. Instead of juggling apps, news, and guesswork, you get plain-language answers that reflect your crops, your weather, and your calendar.",
  "solution.s1": "Know your farm",
  "solution.s1Text":
    "Set up your farm once — location, crops, soil, and planting date — and every answer is grounded in that context.",
  "solution.s2": "Spot problems early",
  "solution.s2Text":
    "Upload a photo of a sick leaf and get a likely diagnosis with clear next steps before damage spreads.",
  "solution.s3": "Plan with the weather",
  "solution.s3Text":
    "See what the forecast actually means for your fields — when to water, spray, or hold off.",
  "solution.s4": "Ask in your language",
  "solution.s4Text":
    "Chat or speak in Urdu, English, Punjabi, and more. No jargon, no guesswork.",
  "solution.previewLabel": "Today on your farm",
  "solution.preview1Label": "Wheat · 62 days since planting",
  "solution.preview1Value": "Growth stage: Tillering",
  "solution.preview2Label": "Weather",
  "solution.preview2Value": "28°C · 40% chance of rain tonight",
  "solution.preview3Label": "Risk level",
  "solution.preview3Value": "Low — watch for aphids",
  "solution.preview4Label": "Today's action",
  "solution.preview4Value": "Delay watering until tomorrow's rain passes",
  "solution.previewNote": "Illustrative preview — shown once your farm data is available.",

  /* ---------- Landing: features ---------- */
  "features.eyebrow": "Features",
  "features.title": "Everything your farm needs, in one place",
  "features.subtitle":
    "From diagnosing a sick leaf to deciding today's work, Kissan AI turns complex farming decisions into simple guidance.",
  "features.f1": "AI Crop Doctor",
  "features.f1Text":
    "Upload a photo of an affected leaf and get a likely diagnosis with confidence, severity, and clear next steps.",
  "features.f2": "AI Assistant",
  "features.f2Text":
    "Ask anything about your farm in plain language and get answers grounded in your crops, soil, and season.",
  "features.f3": "Voice Assistant",
  "features.f3Text":
    "Speak naturally in Urdu, Punjabi, Saraiki, or English — no typing needed in the field.",
  "features.f4": "Weather Intelligence",
  "features.f4Text":
    "Understand what the forecast means for your farm — when to water, spray, or harvest.",
  "features.f5": "Risks & Alerts",
  "features.f5Text":
    "See low, medium, and high risks with clear explanations and the exact action to take.",
  "features.f6": "Today's Actions",
  "features.f6Text":
    "A short, prioritized list of what actually matters today — no more guessing.",
  "features.f7": "Yield Prediction",
  "features.f7Text":
    "See an expected yield range and the key factors driving it, so you can plan sales and inputs.",

  /* ---------- Landing: how it works ---------- */
  "how.eyebrow": "How It Works",
  "how.title": "From setup to action in four steps",
  "how.s1Title": "Set up your farm",
  "how.s1Text":
    "Enter your location, crops, soil, and planting date once — it takes minutes.",
  "how.s2Title": "Share what you see",
  "how.s2Text":
    "Upload a leaf photo, check the weather, or ask about a concern you have.",
  "how.s3Title": "Get clear answers",
  "how.s3Text":
    "Receive plain-language explanations in your language, tied to your farm.",
  "how.s4Title": "Act with confidence",
  "how.s4Text":
    "Follow a short list of prioritized actions for today and track your progress.",

  /* ---------- Landing: testimonials ---------- */
  "testimonials.eyebrow": "Testimonials",
  "testimonials.title": "Farmers trust Kissan AI",
  "testimonials.subtitle": "Real voices from farmers using Kissan AI in their fields.",
  "testimonials.q1":
    "I used to ask everyone for advice — neighbours, YouTube, sometimes even strangers. Kissan AI gives me an answer about MY farm, in my own language.",
  "testimonials.n1": "Muhammad Aslam",
  "testimonials.r1": "Wheat & cotton farmer, Punjab",
  "testimonials.q2":
    "The photo of my tomato leaves looked fine to me, but the diagnosis caught a fungus early. That one warning saved a big part of my crop.",
  "testimonials.n2": "Ayesha Bibi",
  "testimonials.r2": "Vegetable grower, Sindh",
  "testimonials.q3":
    "What I love is the 'today's actions' list. I open it in the morning and I know exactly what to do. It feels like having an expert in my pocket.",
  "testimonials.n3": "Rana Imran",
  "testimonials.r3": "Rice farmer, Khyber Pakhtunkhwa",
  "testimonials.stars": "5 out of 5 stars",

  /* ---------- Landing: FAQ ---------- */
  "faq.eyebrow": "FAQ",
  "faq.title": "Questions farmers ask us",
  "faq.subtitle": "Frequently asked questions about Kissan AI.",
  "faq.q1": "What is Kissan AI?",
  "faq.a1":
    "Kissan AI is an AI-powered farming decision assistant. It brings together your farm's crops, weather, risks, and expected yield into one clear picture — then tells you what to do today, in plain language.",
  "faq.q2": "Do I need to be tech-savvy to use it?",
  "faq.a2":
    "Not at all. Kissan AI is designed to be simple: big buttons, your own language, and even voice input. If you can send a message, you can use Kissan AI.",
  "faq.q3": "Which languages are supported?",
  "faq.a3":
    "You can chat and speak in Urdu, English, Punjabi, and Saraiki, with more on the way. Answers come back in the same language you use.",
  "faq.q4": "How accurate are the diagnoses and predictions?",
  "faq.a4":
    "Kissan AI gives you estimates and guidance to help you decide — never a guarantee. You'll always see confidence levels, and you should confirm critical cases with a local agricultural expert or extension officer.",
  "faq.q5": "Is my farm data private?",
  "faq.a5":
    "Yes. Your farm information is used only to personalise your guidance and is never sold or shared. You stay in control of your farm profile.",
  "faq.q6": "What do I need to get started?",
  "faq.a6":
    "Just set up your farm profile — location, crops, soil, and planting date. It takes a couple of minutes, and then every feature is tailored to your farm.",

  /* ---------- Landing: contact ---------- */
  "contact.eyebrow": "Contact",
  "contact.title": "Let's grow together",
  "contact.subtitle":
    "Have a question, partnership idea, or feedback? We'd love to hear from you — in Urdu, English, or any language you're comfortable with.",
  "contact.email": "Email",
  "contact.phone": "Phone / WhatsApp",
  "contact.basedIn": "Based in",
  "contact.basedInValue": "Lahore, Pakistan — built for farmers everywhere",
  "contact.formTitle": "Send us a message",
  "contact.name": "Your name",
  "contact.namePlaceholder": "e.g. Ahmad Khan",
  "contact.emailPhone": "Email or phone",
  "contact.emailPhonePlaceholder": "you@example.com or +92 3XX XXXXXXX",
  "contact.message": "Message",
  "contact.messagePlaceholder": "Tell us about your farm or your question…",
  "contact.send": "Send Message",
  "contact.replyNote": "We reply within 1–2 working days.",
  "contact.successTitle": "Shukriya — message received!",
  "contact.successText":
    "We've got your message and will get back to you soon. In the meantime, set up your farm and explore what Kissan AI can do.",

  /* ---------- Landing: footer ---------- */
  "footer.tagline":
    "Your AI farming decision assistant — understand your farm and know what to do today.",
  "footer.quickLinks": "Quick Links",
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.rights": "All rights reserved.",

  /* ---------- Page titles ---------- */
  "page.farmSetup": "Farm Setup",
  "page.dashboard": "Dashboard",
  "page.cropDoctor": "Crop Doctor",
  "page.assistant": "Assistant",
  "page.voice": "Voice",
  "page.weather": "Weather",
  "page.risks": "Risks & Alerts",
  "page.yield": "Yield Prediction",
  "page.actions": "Today's Actions",
  "page.diagnosisHistory": "Diagnosis History",
  "page.chatHistory": "Chat History",
  "page.farmProfile": "Farm Profile",
  "page.cropRecommendation": "Smart Crop Recommendation",
  "page.landing": "Kissan AI — Smart Farming Assistant",

  /* ---------- App page headers & sections ---------- */
  "farmSetup.editTitle": "Edit Farm",
  "farmSetup.createTitle": "Set Up Your Farm",
  "farmSetup.subtitle":
    "Tell us about your farm so Kissan AI guidance is tailored to you.",
  "farmSetup.sectionFarmer": "Farmer Information",
  "farmSetup.sectionFarm": "Farm Information",
  "farmSetup.sectionCrop": "Crop Information",
  "farmSetup.farmerName": "Farmer name *",
  "farmSetup.farmerNamePlaceholder": "e.g. Muhammad Aslam",
  "farmSetup.phone": "Phone (optional)",
  "farmSetup.phonePlaceholder": "03xx-xxxxxxx",
  "farmSetup.email": "Email (optional)",
  "farmSetup.emailPlaceholder": "you@example.com",
  "farmSetup.location": "Location *",
  "farmSetup.locationPlaceholder": "e.g. Sheikhupura, Punjab",
  "farmSetup.landArea": "Land area *",
  "farmSetup.landAreaPlaceholder": "e.g. 5 acres",
  "farmSetup.soilType": "Soil type *",
  "farmSetup.selectSoil": "Select soil type",
  "farmSetup.irrigation": "Irrigation method *",
  "farmSetup.selectIrrigation": "Select irrigation",
  "farmSetup.currentCrop": "Current crop *",
  "farmSetup.currentCropPlaceholder": "e.g. Wheat",
  "farmSetup.variety": "Variety (optional)",
  "farmSetup.varietyPlaceholder": "e.g. Galaxy-2013",
  "farmSetup.plantingDate": "Planting date (optional)",
  "farmSetup.createBtn": "Create Farm",
  "farmSetup.updateBtn": "Update Farm",
  "farmSetup.creating": "Creating your farm…",
  "farmSetup.saving": "Saving changes…",
  "farmSetup.updated": "Farm updated!",
  "farmSetup.created": "Farm created!",
  "farmSetup.takingYou": "Taking you to your dashboard…",
  "farmSetup.saveErrorTitle": "Couldn't save your farm",
  "farmSetup.secureNote":
    "Your farm profile is saved securely to the cloud so it's with you on every device.",
  "farmSetup.errName": "Please enter the farmer's name.",
  "farmSetup.errEmail": "Please enter a valid email address.",
  "farmSetup.errLocation": "Please enter your farm's location.",
  "farmSetup.errLandArea": "Please enter your land area.",
  "farmSetup.errLandAreaPositive": "Land area must be a positive number (e.g. 5 or 5 acres).",
  "farmSetup.errSoil": "Please select your soil type.",
  "farmSetup.errIrrigation": "Please select your irrigation method.",
  "farmSetup.errCrop": "Please enter your current crop.",
  "farmSetup.errPlantingDate": "Please enter a valid planting date.",
  "farmSetup.errPlantingFuture": "Planting date can't be in the future.",
  "farmSetup.saveErrorBody":
    "We couldn't save your farm right now. Please check your connection and try again.",

  "dashboard.welcome": "Welcome, {name}",
  "dashboard.subtitle": "{crop} farm · {location}",
  "dashboard.setupTitle": "Set up your farm to unlock Kissan AI",
  "dashboard.setupDesc":
    "Add your farmer, farm, and crop details once — every Kissan AI insight is then tailored to your farm.",
  "dashboard.editFarm": "Edit Farm",
  "dashboard.quickAccess": "Quick Access",
  "dashboard.quickAccessSub": "Jump to a Kissan AI tool",
  "dashboard.analyzeCrop": "Analyze Crop",
  "dashboard.askAssistant": "Ask Kissan AI",
  "dashboard.myFarm": "My Farm",
  "dashboard.myFarmSub": "The farm Kissan AI is working with",
  "dashboard.farmer": "Farmer",
  "dashboard.location": "Location",
  "dashboard.landArea": "Land area",
  "dashboard.soil": "Soil",
  "dashboard.irrigation": "Irrigation",
  "dashboard.crop": "Crop",
  "dashboard.variety": "Variety",
  "dashboard.plantingDate": "Planting date",
  "dashboard.growthStage": "Growth Stage",
  "dashboard.growthStageSub": "Crop age and current stage",
  "dashboard.todayActions": "Today's Actions",
  "dashboard.todayActionsSub": "Your decision plan, built from real farm data",
  "dashboard.weather": "Weather",
  "dashboard.weatherSub": "Conditions that affect your crop today",
  "dashboard.riskAlerts": "Risk Alerts",
  "dashboard.riskAlertsSub": "Threats to watch for",
  "dashboard.noActiveRisks": "No active risks detected",
  "dashboard.noActiveRisksSub":
    "That doesn't guarantee your crop is completely safe — run an assessment to check for threats.",
  "dashboard.assessRisks": "Assess risks",
  "dashboard.highPriority": "{n} high-priority risk to act on",
  "dashboard.highPriorityPlural": "{n} high-priority risks to act on",
  "dashboard.riskDetected": "{n} risk alert detected",
  "dashboard.riskDetectedPlural": "{n} risk alerts detected",
  "dashboard.riskCounts": "{high} high · {medium} medium · {low} low",
  "dashboard.recommended": "Recommended: ",
  "dashboard.viewAllRisks": "View all risks",
  "dashboard.cropHealth": "Crop Health",
  "dashboard.cropHealthSub": "Your most recent crop check",
  "dashboard.noDiagnosisTitle": "No crop diagnosis yet",
  "dashboard.noDiagnosisDesc":
    "Analyze a crop photo with the AI Crop Doctor and the result will appear here with severity, confidence, and what to do next.",
  "dashboard.diagnosedOn": "{crop} · {conf}% confidence · Diagnosed {date}",
  "dashboard.whatToDoNext": "What to do next",
  "dashboard.diagnosisHistory": "Diagnosis history",
  "dashboard.yieldEstimate": "Yield Estimate",
  "dashboard.yieldEstimateSub": "Prediction range and confidence",
  "dashboard.yieldUnavailable": "Yield estimate is not available yet.",
  "dashboard.yieldUnavailableSub":
    "Yield prediction needs crop, weather, and growth history. Collect more farm data to unlock an estimate.",
  "dashboard.viewYield": "View Yield",
  "dashboard.recentActivity": "Recent Activity",
  "dashboard.recentActivitySub": "What's been happening on your farm",
  "dashboard.noRecentActivity": "No recent activity",
  "dashboard.noRecentActivityDesc":
    "Diagnoses, completed actions, risk alerts, and chats will show up here as they happen.",
  "dashboard.severity": "{level} severity",
  "dashboard.risk": "{level} risk",
  "dashboard.justNow": "Just now",
  "dashboard.minAgo": "{n}m ago",
  "dashboard.hrAgo": "{n}h ago",
  "dashboard.daysAgo": "{n} days ago",
  "dashboard.yesterday": "Yesterday",

  "cropDoctor.title": "AI Crop Doctor",
  "cropDoctor.subtitle": "Diagnose crop problems from a photo",
  "assistant.title": "AI Assistant",
  "assistant.subtitle": "Ask anything about your farm",
  "voice.title": "Voice Assistant",

  /* ---------- Smart Crop Recommendation (Prompt 13) ---------- */
  "cropRec.title": "Smart Crop Recommendation",
  "cropRec.subtitle":
    "Discover crops that may be suitable for your farm based on your soil, location, irrigation, weather, and farm conditions.",
  "cropRec.myFarm": "My Farm",
  "cropRec.myFarmSub": "The farm information we use to tailor these recommendations",
  "cropRec.location": "Location",
  "cropRec.soil": "Soil",
  "cropRec.irrigation": "Irrigation",
  "cropRec.landArea": "Farm Area",
  "cropRec.currentCrop": "Current Crop",
  "cropRec.variety": "Variety",
  "cropRec.plantingDate": "Planting date",
  "cropRec.growthStage": "Growth stage",
  "cropRec.getRecommendations": "Get Crop Recommendations",
  "cropRec.gettingRecommendations": "Getting your recommendations…",
  "cropRec.analyzing": "Analyzing your farm conditions…",
  "cropRec.analyzeDesc":
    "We're studying your soil, irrigation, weather, and farm context to suggest crops that may suit your farm. This usually takes a few seconds.",
  "cropRec.resultsTitle": "Your Crop Recommendations",
  "cropRec.resultsSub": "Estimated suitability based on the available farm information",
  "cropRec.summaryTitle": "Summary",
  "cropRec.whyTitle": "Why this crop?",
  "cropRec.soilFit": "Soil fit",
  "cropRec.waterRequirement": "Water requirement",
  "cropRec.weatherFit": "Weather fit",
  "cropRec.keyConsiderations": "Key considerations",
  "cropRec.confidence": "{n}% confidence",
  "cropRec.suit.high": "Highly Suitable",
  "cropRec.suit.moderate": "Moderately Suitable",
  "cropRec.suit.low": "Less Suitable",
  "cropRec.advisoryNote":
    "These are advisory, estimated recommendations based on the available farm information — not a guarantee of yield, profit, or success. Consider local agricultural advice before making major planting decisions.",
  "cropRec.limitationsTitle": "Notes & limitations",
  "cropRec.weatherUnavailable":
    "Weather information is currently unavailable. Recommendations are based on the other available farm information.",
  "cropRec.missingTitle": "We need a little more information",
  "cropRec.missingDesc":
    "A little more information will help us recommend crops that may suit your farm. The following is missing:",
  "cropRec.updateProfile": "Update Farm Profile",
  "cropRec.errorTitle": "We couldn't generate crop recommendations right now",
  "cropRec.errorDesc": "Please try again in a moment. Your farm information is safe.",
  "cropRec.retry": "Try again",
  "cropRec.historyTitle": "Previous Recommendations",
  "cropRec.historySub": "Crop recommendation runs saved for your farm",
  "cropRec.noHistory": "No crop recommendations yet",
  "cropRec.noHistoryDesc":
    "When you request crop recommendations, your saved results will appear here.",
  "cropRec.viewReport": "View report",
  "cropRec.reportedOn": "Generated {date}",
  "weather.title": "Weather Intelligence",
  "risks.title": "Farm Risk",
  "yield.title": "Yield Prediction",
  "actions.title": "Today's Actions",
  "farmProfile.title": "Farm Profile",
  "farmProfile.subtitle": "Your farm details and settings",
  "diagnosisHistory.title": "Diagnosis History",
  "chatHistory.title": "Chat History",
  "chatHistory.subtitle": "Past conversations",

  /* ---------- Authentication ---------- */
  "auth.brandSubtitle": "Your AI Farming Decision Assistant",
  "auth.loginTitle": "Welcome back",
  "auth.loginSubtitle": "Log in to your Kissan AI account.",
  "auth.signupTitle": "Create your account",
  "auth.signupSubtitle": "Set up a Kissan AI account to manage your farm.",
  "auth.forgotTitle": "Reset your password",
  "auth.forgotSubtitle": "Enter your email and we'll send you a reset link.",
  "auth.resetTitle": "Choose a new password",
  "auth.resetSubtitle": "Enter a strong new password for your account.",
  "auth.email": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.password": "Password",
  "auth.passwordPlaceholder": "Your password",
  "auth.confirmPassword": "Confirm password",
  "auth.confirmPasswordPlaceholder": "Repeat your password",
  "auth.newPassword": "New password",
  "auth.newPasswordPlaceholder": "Your new password",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.login": "Log In",
  "auth.signup": "Sign Up",
  "auth.signingIn": "Logging you in…",
  "auth.signingUp": "Creating your account…",
  "auth.sendReset": "Send Reset Link",
  "auth.sendingReset": "Sending reset link…",
  "auth.updatePassword": "Update Password",
  "auth.updatingPassword": "Updating password…",
  "auth.logout": "Log out",
  "auth.forgotPassword": "Forgot password?",
  "auth.noAccount": "Don't have an account?",
  "auth.haveAccount": "Already have an account?",
  "auth.createAccount": "Create an Account",
  "auth.backToLogin": "Back to Login",
  "auth.rememberFor": "Kept signed in on this device.",
  "auth.languageNote": "Language and theme are remembered from your visit.",
  "auth.confirmEmailTitle": "Check your email",
  "auth.confirmEmailBody":
    "We've sent a confirmation link to {email}. Please open it to verify your address, then log in.",
  "auth.emailSent": "Check your email",
  "auth.emailSentBody":
    "If {email} belongs to an account, a password reset link is on its way. Follow it to choose a new password.",
  "auth.resetSuccess": "Password updated!",
  "auth.resetSuccessBody": "Your password has been changed. Log in with your new password.",
  "auth.loadingSession": "Loading your session…",
  "auth.errEmailRequired": "Please enter your email address.",
  "auth.errEmailInvalid": "Please enter a valid email address.",
  "auth.errPasswordRequired": "Please enter your password.",
  "auth.errPasswordTooShort": "Password must be at least 6 characters.",
  "auth.errPasswordMismatch": "Passwords do not match.",
  "auth.errConfirmRequired": "Please confirm your password.",
  "auth.errGeneric": "Something went wrong. Please try again.",
  "auth.errInvalidCredentials": "Incorrect email or password. Please try again.",
  "auth.errEmailTaken": "An account with this email already exists.",
  "auth.errResetFailed": "We couldn't reset your password. Please try again.",
  "auth.redirDashboard": "Taking you to your dashboard…",
  "auth.redirectLogin": "Back to Login",
  "auth.signupApproach": "Create your farm after you're signed in.",
};

const ur: Dict = {
  /* ---------- Brand ---------- */
  "brand.name": "کسان اے آئی",
  "brand.tagline": "آپ کا اے آئی فارمنگ فیصلہ اسسٹنٹ",

  /* ---------- Landing nav ---------- */
  "nav.home": "ہوم",
  "nav.features": "خصوصیات",
  "nav.howItWorks": "یہ کیسے کام کرتا ہے",
  "nav.problem": "مسئلہ",
  "nav.solution": "حل",
  "nav.about": "ہمارے بارے میں",
  "nav.faq": "سوالات",
  "nav.contact": "رابطہ",
  "nav.login": "لاگ ان",
  "nav.getStarted": "شروع کریں",
  "nav.openMenu": "مینو کھولیں",
  "nav.closeMenu": "مینو بند کریں",
  "nav.main": "مینو",
  "nav.primary": "بنیادی",
  "nav.aiTools": "AI ٹولز",
  "nav.manage": "انتظام",
  "nav.bottom": "نیچے",
  "nav.more": "مزید",

  /* ---------- App nav ---------- */
  "app.nav.dashboard": "ڈیش بورڈ",
  "app.nav.cropDoctor": "فصل ڈاکٹر",
  "app.nav.assistant": "اسسٹنٹ",
  "app.nav.voice": "آواز",
  "app.nav.weather": "موسم",
  "app.nav.todayActions": "آج کے کام",
  "app.nav.farmProfile": "فارم پروفائل",
  "app.nav.risksAlerts": "خطرات اور انتباہات",
  "app.nav.yieldPrediction": "پیداوار کی پیش گوئی",
  "app.nav.cropRecommendation": "فصل کی سفارش",
  "app.nav.diagnosisHistory": "تشخیص کی تاریخ",
  "app.nav.chatHistory": "چیٹ کی تاریخ",
  "app.nav.noFarm": "ابھی کوئی فارم نہیں بنایا گیا",

  /* ---------- Common UI ---------- */
  "common.loading": "لوڈ ہو رہا ہے…",
  "common.loadingFarm": "آپ کا فارم لوڈ ہو رہا ہے…",
  "common.retry": "دوبارہ کوشش کریں",
  "common.save": "محفوظ کریں",
  "common.saving": "محفوظ ہو رہا ہے…",
  "common.cancel": "منسوخ کریں",
  "common.back": "واپس",
  "common.search": "تلاش کریں",
  "common.noResults": "کوئی نتیجہ نہیں",
  "common.today": "آج",
  "common.language": "زبان",
  "common.theme": "تھیم",
  "common.light": "روشنی",
  "common.dark": "اندھیرا",
  "common.error": "کچھ غلط ہو گیا",
  "common.optional": "اختیاری",

  /* ---------- Landing: hero ---------- */
  "hero.badge": "آپ کا اے آئی فارمنگ فیصلہ اسسٹنٹ",
  "hero.titleA": "اپنے فارم کو سمجھیں۔",
  "hero.titleB": "جانیں آج کیا کرنا ہے۔",
  "hero.subtitle":
    "کسان اے آئی آپ کے فارم کی فصلیں، موسم، خطرات اور متوقع پیداوار کو ایک واضح تصویر میں جوڑتا ہے — سادہ اور قابلِ عمل رہنمائی کے ساتھ، آپ کی زبان میں۔",
  "hero.cta": "اپنا فارم بنائیں",
  "hero.explore": "ڈیش بورڈ دیکھیں",
  "hero.h1": "فارم مرکوز",
  "hero.h1Text":
    "آپ کی فصلوں، مٹی اور مقام کے مطابق رہنمائی — عام مشورہ نہیں۔",
  "hero.h2": "مسئلہ جلد پکڑیں",
  "hero.h2Text":
    "بیمار پتے کی تصویر اپ لوڈ کریں اور جانئے کیا ہو سکتا ہے۔",
  "hero.h3": "اپنی زبان میں پوچھیں",
  "hero.h3Text": "اردو، انگریزی، پنجابی اور مزید میں لکھیں یا بولیں۔",

  /* ---------- Landing: problem ---------- */
  "problem.eyebrow": "مسئلہ",
  "problem.title": "کھیتی باڑی غیر یقینی صورتحال سے بھری ہے",
  "problem.subtitle":
    "چھوٹے کسان ہر روز اہم فیصلے کرتے ہیں — لیکن اکثر بکھری، پرانی یا عام معلومات کے ساتھ۔",
  "problem.p1": "بے وقت موسم",
  "problem.p1Text":
    "بارش، گرمی اور پالا بغیر اطلاع کے آتے ہیں، جس سے کسان اندازہ نہیں لگا پاتے کہ کب بونا، پانی دینا یا فصل کاٹنی ہے۔",
  "problem.p2": "کیڑے اور بیماریاں تیزی سے پھیلتی ہیں",
  "problem.p2Text":
    "جب تک علامات نظر آتی ہیں، نقصان ہو چکا ہوتا ہے۔ جلد پتہ چلنا ہی فصل بچانے کی کلید ہے۔",
  "problem.p3": "مشورہ مقامی نہیں ہوتا",
  "problem.p3Text":
    "عام مشورے آپ کی مٹی، فصل، موسم اور تقویم کو نظر انداز کرتے ہیں — اس لیے زیادہ تر مشورہ آپ کے فارم پر لاگو نہیں ہوتا۔",
  "problem.p4": "بہت سارے فیصلے، بہت کم وقت",
  "problem.p4Text":
    "ادویات، موسم اور روزمرہ کے کام کے درمیان یہ جاننا مشکل ہے کہ آج واقعی کیا اہم ہے۔",

  /* ---------- Landing: solution ---------- */
  "solution.eyebrow": "حل",
  "solution.title": "آپ کے فارم کی ایک واضح تصویر — اور آج کیا کرنا ہے",
  "solution.subtitle":
    "کسان اے آئی ایک فارم مرکوز فیصلہ انجن ہے۔ ایپس، خبروں اور اندازوں کو جگل کرنے کی بجائے، آپ کو سادہ زبان میں جواب ملتے ہیں جو آپ کی فصلوں، موسم اور تقویم کی عکاسی کرتے ہیں۔",
  "solution.s1": "اپنے فارم کو جانیں",
  "solution.s1Text":
    "اپنا فارم ایک بار ترتیب دیں — مقام، فصلیں، مٹی اور بونے کی تاریخ — اور ہر جواب اسی سیاق سے جڑا ہوگا۔",
  "solution.s2": "مسئلہ جلد پکڑیں",
  "solution.s2Text":
    "بیمار پتے کی تصویر اپ لوڈ کریں اور نقصان پھیلنے سے پہلے ممکنہ تشخیص اور واضح اگلے اقدامات حاصل کریں۔",
  "solution.s3": "موسم کے ساتھ منصوبہ بنائیں",
  "solution.s3Text":
    "دیکھیں پیش گوئی آپ کے کھیت کے لیے کیا معنی رکھتی ہے — کب پانی دینا، چھڑکاؤ کرنا یا رکنا ہے۔",
  "solution.s4": "اپنی زبان میں پوچھیں",
  "solution.s4Text":
    "اردو، انگریزی، پنجابی اور مزید میں بات کریں یا لکھیں۔ کوئی پیچیدہ اصطلاح نہیں، کوئی اندازہ نہیں۔",
  "solution.previewLabel": "آج آپ کے فارم پر",
  "solution.preview1Label": "گندم · بونے کے 62 دن",
  "solution.preview1Value": "نشوونما کا مرحلہ: شاخیں نکلنا",
  "solution.preview2Label": "موسم",
  "solution.preview2Value": "28°C · آج رات بارش کا 40% امکان",
  "solution.preview3Label": "خطرے کی سطح",
  "solution.preview3Value": "کم — میلی بگ پر نظر رکھیں",
  "solution.preview4Label": "آج کا کام",
  "solution.preview4Value": "کل کی بارش گزرنے تک پانی دینا مؤخر کریں",
  "solution.previewNote": "نمائشی پیش نظارہ — آپ کا فارم ڈیٹا دستیاب ہونے پر دکھایا جائے گا۔",

  /* ---------- Landing: features ---------- */
  "features.eyebrow": "خصوصیات",
  "features.title": "آپ کے فارم کی ہر ضرورت، ایک جگہ",
  "features.subtitle":
    "بیمار پتے کی تشخیص سے لے کر آج کے کام طے کرنے تک، کسان اے آئی پیچیدہ کھیتی کے فیصلوں کو سادہ رہنمائی میں بدل دیتا ہے۔",
  "features.f1": "اے آئی فصل ڈاکٹر",
  "features.f1Text":
    "متاثرہ پتے کی تصویر اپ لوڈ کریں اور اعتماد، شدت اور واضح اگلے اقدامات کے ساتھ ممکنہ تشخیص حاصل کریں۔",
  "features.f2": "اے آئی اسسٹنٹ",
  "features.f2Text":
    "سادہ زبان میں اپنے فارم کے بارے میں کچھ بھی پوچھیں اور جواب اپنی فصلوں، مٹی اور موسم کی بنیاد پر حاصل کریں۔",
  "features.f3": "وائس اسسٹنٹ",
  "features.f3Text":
    "اردو، پنجابی، سرائیکی یا انگریزی میں قدرتی انداز سے بولیں — کھیت میں ٹائپنگ کی ضرورت نہیں۔",
  "features.f4": "موسمی معلومات",
  "features.f4Text":
    "سمجھیں پیش گوئی آپ کے فارم کے لیے کیا معنی رکھتی ہے — کب پانی دینا، چھڑکاؤ کرنا یا فصل کاٹنی ہے۔",
  "features.f5": "خطرات اور انتباہات",
  "features.f5Text":
    "کم، درمیانے اور زیادہ خطرات کو واضح وضاحت اور درست اقدام کے ساتھ دیکھیں۔",
  "features.f6": "آج کے کام",
  "features.f6Text":
    "آج واقعی کیا اہم ہے اس کی مختصر، ترجیحی فہرست — مزید اندازہ نہیں۔",
  "features.f7": "پیداوار کی پیش گوئی",
  "features.f7Text":
    "متوقع پیداوار کی حد اور اس کے اہم عوامل دیکھیں، تاکہ آپ فروخت اور ادویات کی منصوبہ بندی کر سکیں۔",

  /* ---------- Landing: how it works ---------- */
  "how.eyebrow": "یہ کیسے کام کرتا ہے",
  "how.title": "سیٹ اپ سے عمل تک چار آسان مراحل",
  "how.s1Title": "اپنا فارم ترتیب دیں",
  "how.s1Text":
    "اپنا مقام، فصلیں، مٹی اور بونے کی تاریخ ایک بار درج کریں — چند منٹ لگتے ہیں۔",
  "how.s2Title": "جو دیکھیں وہ شیئر کریں",
  "how.s2Text":
    "پتے کی تصویر اپ لوڈ کریں، موسم چیک کریں، یا اپنی تشویش کے بارے میں پوچھیں۔",
  "how.s3Title": "واضح جواب حاصل کریں",
  "how.s3Text":
    "آپ کی زبان میں سادہ وضاحتیں حاصل کریں، جو آپ کے فارم سے جڑی ہوں۔",
  "how.s4Title": "اعتماد سے عمل کریں",
  "how.s4Text":
    "آج کے لیے ترجیحی اقدامات کی مختصر فہرست پر عمل کریں اور اپنی پیش رفت دیکھیں۔",

  /* ---------- Landing: testimonials ---------- */
  "testimonials.eyebrow": "تاثرات",
  "testimonials.title": "کسان کسان اے آئی پر بھروسہ کرتے ہیں",
  "testimonials.subtitle": "اپنے کھیتوں میں کسان اے آئی استعمال کرنے والے کسانوں کی آوازیں۔",
  "testimonials.q1":
    "پہلے میں ہر کسی سے مشورہ لیتا تھا — پڑوسی، یوٹیوب، کبھی اجنبیوں سے بھی۔ کسان اے آئی مجھے میرے فارم کے بارے میں، میری اپنی زبان میں جواب دیتا ہے۔",
  "testimonials.n1": "محمد اسلم",
  "testimonials.r1": "گندم اور کپاس کے کسان، پنجاب",
  "testimonials.q2":
    "میرے ٹماٹر کے پتے مجھے ٹھیک لگ رہے تھے، لیکن تشخیص نے فنگس کو جلد پکڑ لیا۔ اس ایک انتباہ نے میری فصل کا بڑا حصہ بچا لیا۔",
  "testimonials.n2": "عائشہ بی بی",
  "testimonials.r2": "سبزیاں اگانے والی، سندھ",
  "testimonials.q3":
    "مجھے 'آج کے کام' کی فہرست بہت پسند ہے۔ میں صبح اسے کھولتا ہوں اور مجھے معلوم ہوتا ہے کہ کیا کرنا ہے۔ ایسا لگتا ہے جیسے میری جیب میں کوئی ماہر ہو۔",
  "testimonials.n3": "رانا عمران",
  "testimonials.r3": "چاول کے کسان، خیبر پختونخوا",
  "testimonials.stars": "5 میں سے 5 ستارے",

  /* ---------- Landing: FAQ ---------- */
  "faq.eyebrow": "سوالات",
  "faq.title": "کسانوں کے اکثر سوالات",
  "faq.subtitle": "کسان اے آئی کے بارے میں اکثر پوچھے جانے والے سوالات۔",
  "faq.q1": "کسان اے آئی کیا ہے؟",
  "faq.a1":
    "کسان اے آئی ایک اے آئی پر مبنی فارمنگ فیصلہ اسسٹنٹ ہے۔ یہ آپ کے فارم کی فصلیں، موسم، خطرات اور متوقع پیداوار کو ایک واضح تصویر میں جمع کرتا ہے — پھر آپ کو سادہ زبان میں بتاتا ہے کہ آج کیا کرنا ہے۔",
  "faq.q2": "کیا مجھے ٹیکنالوجی کا ماہر ہونا ضروری ہے؟",
  "faq.a2":
    "بالکل نہیں۔ کسان اے آئی سادہ بنایا گیا ہے: بڑے بٹن، آپ کی اپنی زبان، اور آواز سے بات کرنے کی سہولت۔ اگر آپ میسج بھیج سکتے ہیں تو کسان اے آئی استعمال کر سکتے ہیں۔",
  "faq.q3": "کون سی زبانیں سپورٹ ہوتی ہیں؟",
  "faq.a3":
    "آپ اردو، انگریزی، پنجابی اور سرائیکی میں بات یا تحریر کر سکتے ہیں، اور مزید زبانیں شامل ہو رہی ہیں۔ جواب اسی زبان میں آتے ہیں جس زبان میں آپ بات کرتے ہیں۔",
  "faq.q4": "تشخیص اور پیش گوئیاں کتنی درست ہیں؟",
  "faq.a4":
    "کسان اے آئی آپ کو فیصلے میں مدد کے لیے تخمینے اور رہنمائی دیتا ہے — کبھی کوئی ضمانت نہیں۔ آپ کو ہمیشہ اعتماد کی سطح نظر آئے گی، اور اہم معاملات میں مقامی زرعی ماہر یا ایکسٹینشن آفیسر سے تصدیق کریں۔",
  "faq.q5": "کیا میرا فارم ڈیٹا نجی ہے؟",
  "faq.a5":
    "جی ہاں۔ آپ کے فارم کی معلومات صرف آپ کی رہنمائی کو ذاتی بنانے کے لیے استعمال ہوتی ہے اور کبھی فروخت یا شیئر نہیں کی جاتی۔ آپ اپنے فارم پروفائل پر خود کنٹرول رکھتے ہیں۔",
  "faq.q6": "شروع کرنے کے لیے مجھے کیا چاہیے؟",
  "faq.a6":
    "بس اپنا فارم پروفائل بنائیں — مقام، فصلیں، مٹی اور بونے کی تاریخ۔ اس میں چند منٹ لگتے ہیں، اور پھر ہر فیچر آپ کے فارم کے مطابق ہوتا ہے۔",

  /* ---------- Landing: contact ---------- */
  "contact.eyebrow": "رابطہ",
  "contact.title": "آئیے مل کر ترقی کریں",
  "contact.subtitle":
    "سوال، شراکت کا خیال یا رائے؟ ہمیں آپ سے سننا پسند ہے — اردو، انگریزی یا کسی بھی زبان میں جس میں آپ آسانی محسوس کریں۔",
  "contact.email": "ای میل",
  "contact.phone": "فون / واٹس ایپ",
  "contact.basedIn": "مقام",
  "contact.basedInValue": "لاہور، پاکستان — ہر جگہ کے کسانوں کے لیے بنایا گیا",
  "contact.formTitle": "ہمیں پیغام بھیجیں",
  "contact.name": "آپ کا نام",
  "contact.namePlaceholder": "مثلاً احمد خان",
  "contact.emailPhone": "ای میل یا فون",
  "contact.emailPhonePlaceholder": "you@example.com یا +92 3XX XXXXXXX",
  "contact.message": "پیغام",
  "contact.messagePlaceholder": "اپنے فارم یا سوال کے بارے میں بتائیں…",
  "contact.send": "پیغام بھیجیں",
  "contact.replyNote": "ہم 1–2 کام کے دنوں میں جواب دیتے ہیں۔",
  "contact.successTitle": "شکریہ — پیغام موصول ہو گیا!",
  "contact.successText":
    "ہم نے آپ کا پیغام حاصل کر لیا ہے اور جلد آپ سے رابطہ کریں گے۔ اس دوران اپنا فارم بنائیں اور کسان اے آئی کی سہولیات دیکھیں۔",

  /* ---------- Landing: footer ---------- */
  "footer.tagline":
    "آپ کا اے آئی فارمنگ فیصلہ اسسٹنٹ — اپنے فارم کو سمجھیں اور جانیں آج کیا کرنا ہے۔",
  "footer.quickLinks": "فوری لنکس",
  "footer.product": "پروڈکٹ",
  "footer.company": "کمپنی",
  "footer.rights": "جملہ حقوق محفوظ ہیں۔",

  /* ---------- Page titles ---------- */
  "page.farmSetup": "فارم سیٹ اپ",
  "page.dashboard": "ڈیش بورڈ",
  "page.cropDoctor": "فصل ڈاکٹر",
  "page.assistant": "اسسٹنٹ",
  "page.voice": "آواز",
  "page.weather": "موسم",
  "page.risks": "خطرات اور انتباہات",
  "page.yield": "پیداوار کی پیش گوئی",
  "page.actions": "آج کے کام",
  "page.diagnosisHistory": "تشخیص کی تاریخ",
  "page.chatHistory": "چیٹ کی تاریخ",
  "page.farmProfile": "فارم پروفائل",
  "page.cropRecommendation": "اسمارٹ فصل کی سفارش",
  "page.landing": "کسان اے آئی — اسمارٹ فارمنگ اسسٹنٹ",

  /* ---------- App page headers & sections ---------- */
  "farmSetup.editTitle": "فارم میں ترمیم کریں",
  "farmSetup.createTitle": "اپنا فارم ترتیب دیں",
  "farmSetup.subtitle":
    "ہمیں اپنے فارم کے بارے میں بتائیں تاکہ کسان اے آئی کی رہنمائی آپ کے مطابق ہو۔",
  "farmSetup.sectionFarmer": "کسان کی معلومات",
  "farmSetup.sectionFarm": "فارم کی معلومات",
  "farmSetup.sectionCrop": "فصل کی معلومات",
  "farmSetup.farmerName": "کسان کا نام *",
  "farmSetup.farmerNamePlaceholder": "مثلاً محمد اسلم",
  "farmSetup.phone": "فون (اختیاری)",
  "farmSetup.phonePlaceholder": "03xx-xxxxxxx",
  "farmSetup.email": "ای میل (اختیاری)",
  "farmSetup.emailPlaceholder": "you@example.com",
  "farmSetup.location": "مقام *",
  "farmSetup.locationPlaceholder": "مثلاً شیخوپورہ، پنجاب",
  "farmSetup.landArea": "رقبہ *",
  "farmSetup.landAreaPlaceholder": "مثلاً 5 ایکڑ",
  "farmSetup.soilType": "مٹی کی قسم *",
  "farmSetup.selectSoil": "مٹی کی قسم منتخب کریں",
  "farmSetup.irrigation": "آبپاشی کا طریقہ *",
  "farmSetup.selectIrrigation": "آبپاشی منتخب کریں",
  "farmSetup.currentCrop": "موجودہ فصل *",
  "farmSetup.currentCropPlaceholder": "مثلاً گندم",
  "farmSetup.variety": "قسم (اختیاری)",
  "farmSetup.varietyPlaceholder": "مثلاً Galaxy-2013",
  "farmSetup.plantingDate": "بونے کی تاریخ (اختیاری)",
  "farmSetup.createBtn": "فارم بنائیں",
  "farmSetup.updateBtn": "فارم اپ ڈیٹ کریں",
  "farmSetup.creating": "آپ کا فارم بن رہا ہے…",
  "farmSetup.saving": "تبدیلیاں محفوظ ہو رہی ہیں…",
  "farmSetup.updated": "فارم اپ ڈیٹ ہو گیا!",
  "farmSetup.created": "فارم بن گیا!",
  "farmSetup.takingYou": "آپ کو ڈیش بورڈ پر لے جا رہے ہیں…",
  "farmSetup.saveErrorTitle": "آپ کا فارم محفوظ نہیں ہو سکا",
  "farmSetup.secureNote":
    "آپ کا فارم پروفائل محفوظ طریقے سے کلاؤڈ پر محفوظ کیا جاتا ہے تاکہ یہ ہر ڈیوائس پر آپ کے ساتھ رہے۔",
  "farmSetup.errName": "براہ کرم کسان کا نام درج کریں۔",
  "farmSetup.errEmail": "براہ کرم درست ای میل ایڈریس درج کریں۔",
  "farmSetup.errLocation": "براہ کرم اپنے فارم کا مقام درج کریں۔",
  "farmSetup.errLandArea": "براہ کرم اپنا رقبہ درج کریں۔",
  "farmSetup.errLandAreaPositive": "رقبہ ایک مثبت عدد ہونا چاہیے (مثلاً 5 یا 5 ایکڑ)۔",
  "farmSetup.errSoil": "براہ کرم اپنی مٹی کی قسم منتخب کریں۔",
  "farmSetup.errIrrigation": "براہ کرم اپنا آبپاشی کا طریقہ منتخب کریں۔",
  "farmSetup.errCrop": "براہ کرم اپنی موجودہ فصل درج کریں۔",
  "farmSetup.errPlantingDate": "براہ کرم درست بونے کی تاریخ درج کریں۔",
  "farmSetup.errPlantingFuture": "بونے کی تاریخ مستقبل میں نہیں ہو سکتی۔",
  "farmSetup.saveErrorBody":
    "ہم ابھی آپ کا فارم محفوظ نہیں کر سکے۔ براہ کرم اپنا کنکشن چیک کر کے دوبارہ کوشش کریں۔",

  "dashboard.welcome": "خوش آمدید، {name}",
  "dashboard.subtitle": "{crop} فارم · {location}",
  "dashboard.setupTitle": "کسان اے آئی استعمال کرنے کے لیے اپنا فارم بنائیں",
  "dashboard.setupDesc":
    "اپنے کسان، فارم اور فصل کی تفصیلات ایک بار شامل کریں — پھر ہر کسان اے آئی مشورہ آپ کے فارم کے مطابق ہوگا۔",
  "dashboard.editFarm": "فارم میں ترمیم کریں",
  "dashboard.quickAccess": "فوری رسائی",
  "dashboard.quickAccessSub": "کسان اے آئی کسی بھی ٹول پر جائیں",
  "dashboard.analyzeCrop": "فصل کا تجزیہ کریں",
  "dashboard.askAssistant": "کسان اے آئی سے پوچھیں",
  "dashboard.myFarm": "میرا فارم",
  "dashboard.myFarmSub": "وہ فارم جس کے ساتھ کسان اے آئی کام کر رہا ہے",
  "dashboard.farmer": "کسان",
  "dashboard.location": "مقام",
  "dashboard.landArea": "رقبہ",
  "dashboard.soil": "مٹی",
  "dashboard.irrigation": "آبپاشی",
  "dashboard.crop": "فصل",
  "dashboard.variety": "قسم",
  "dashboard.plantingDate": "بونے کی تاریخ",
  "dashboard.growthStage": "نشوونما کا مرحلہ",
  "dashboard.growthStageSub": "فصل کی عمر اور موجودہ مرحلہ",
  "dashboard.todayActions": "آج کے کام",
  "dashboard.todayActionsSub": "آپ کا فیصلہ پلان، حقیقی فارم ڈیٹا سے بنا",
  "dashboard.weather": "موسم",
  "dashboard.weatherSub": "آج آپ کی فصل کو متاثر کرنے والے حالات",
  "dashboard.riskAlerts": "خطرے کے انتباہات",
  "dashboard.riskAlertsSub": "جن خطرات پر نظر رکھنی ہے",
  "dashboard.noActiveRisks": "کوئی فعال خطرہ نہیں ملا",
  "dashboard.noActiveRisksSub":
    "اس کا مطلب یہ نہیں کہ آپ کی فصل مکمل محفوظ ہے — خطرات جانچنے کے لیے تشخیص چلائیں۔",
  "dashboard.assessRisks": "خطرات کا جائزہ لیں",
  "dashboard.highPriority": "{n} اعلی ترجیحی خطرہ جس پر عمل کرنا ہے",
  "dashboard.highPriorityPlural": "{n} اعلی ترجیحی خطرات جن پر عمل کرنا ہے",
  "dashboard.riskDetected": "{n} خطرے کا انتباہ ملا",
  "dashboard.riskDetectedPlural": "{n} خطرات کے انتباہات ملے",
  "dashboard.riskCounts": "{high} زیادہ · {medium} درمیانہ · {low} کم",
  "dashboard.recommended": "تجویز کردہ: ",
  "dashboard.viewAllRisks": "تمام خطرات دیکھیں",
  "dashboard.cropHealth": "فصل کی صحت",
  "dashboard.cropHealthSub": "آپ کا تازہ ترین فصل چیک",
  "dashboard.noDiagnosisTitle": "ابھی کوئی فصل تشخیص نہیں",
  "dashboard.noDiagnosisDesc":
    "اے آئی فصل ڈاکٹر سے فصل کی تصویر کا تجزیہ کریں اور نتیجہ یہاں شدت، اعتماد اور اگلے اقدامات کے ساتھ نظر آئے گا۔",
  "dashboard.diagnosedOn": "{crop} · {conf}% اعتماد · تشخیص {date}",
  "dashboard.whatToDoNext": "اگلا کیا کرنا ہے",
  "dashboard.diagnosisHistory": "تشخیص کی تاریخ",
  "dashboard.yieldEstimate": "پیداوار کا تخمینہ",
  "dashboard.yieldEstimateSub": "پیش گوئی کی حد اور اعتماد",
  "dashboard.yieldUnavailable": "پیداوار کا تخمینہ ابھی دستیاب نہیں۔",
  "dashboard.yieldUnavailableSub":
    "پیداوار کی پیش گوئی کے لیے فصل، موسم اور نشوونما کی تاریخ درکار ہے۔ تخمینہ کھولنے کے لیے مزید فارم ڈیٹا جمع کریں۔",
  "dashboard.viewYield": "پیداوار دیکھیں",
  "dashboard.recentActivity": "حالیہ سرگرمی",
  "dashboard.recentActivitySub": "آپ کے فارم پر کیا ہو رہا ہے",
  "dashboard.noRecentActivity": "کوئی حالیہ سرگرمی نہیں",
  "dashboard.noRecentActivityDesc":
    "تشخیص، مکمل ہونے والے کام، خطرے کے انتباہات اور چیٹس یہاں نظر آئیں گے۔",
  "dashboard.severity": "{level} شدت",
  "dashboard.risk": "{level} خطرہ",
  "dashboard.justNow": "ابھی",
  "dashboard.minAgo": "{n} منٹ پہلے",
  "dashboard.hrAgo": "{n} گھنٹے پہلے",
  "dashboard.daysAgo": "{n} دن پہلے",
  "dashboard.yesterday": "کل",

  "cropDoctor.title": "اے آئی فصل ڈاکٹر",
  "cropDoctor.subtitle": "تصویر سے فصل کے مسائل کی تشخیص کریں",
  "assistant.title": "اے آئی اسسٹنٹ",
  "assistant.subtitle": "اپنے فارم کے بارے میں کچھ بھی پوچھیں",
  "voice.title": "وائس اسسٹنٹ",

  /* ---------- Smart Crop Recommendation (Prompt 13) ---------- */
  "cropRec.title": "اسمارٹ فصل کی سفارش",
  "cropRec.subtitle":
    "اپنی مٹی، مقام، آبپاشی، موسم اور فارم کے حالات کی بنیاد پر ایسی فصلیں دریافت کریں جو آپ کے فارم کے لیے موزوں ہو سکتی ہیں۔",
  "cropRec.myFarm": "میرا فارم",
  "cropRec.myFarmSub": "وہ فارم معلومات جو ہم ان سفارشات کے لیے استعمال کرتے ہیں",
  "cropRec.location": "مقام",
  "cropRec.soil": "مٹی",
  "cropRec.irrigation": "آبپاشی",
  "cropRec.landArea": "فارم کا رقبہ",
  "cropRec.currentCrop": "موجودہ فصل",
  "cropRec.variety": "قسم",
  "cropRec.plantingDate": "بونے کی تاریخ",
  "cropRec.growthStage": "نشوونما کا مرحلہ",
  "cropRec.getRecommendations": "فصل کی سفارشات حاصل کریں",
  "cropRec.gettingRecommendations": "آپ کی سفارشات حاصل ہو رہی ہیں…",
  "cropRec.analyzing": "آپ کے فارم کے حالات کا تجزیہ ہو رہا ہے…",
  "cropRec.analyzeDesc":
    "ہم آپ کی مٹی، آبپاشی، موسم اور فارم کے سیاق کے مطابق تجویز کردہ فصلیں تلاش کر رہے ہیں۔ اس میں عام طور پر چند سیکنڈ لگتے ہیں۔",
  "cropRec.resultsTitle": "آپ کی فصل کی سفارشات",
  "cropRec.resultsSub": "دستیاب فارم معلومات کی بنیاد پر تخمینی موزوںیت",
  "cropRec.summaryTitle": "خلاصہ",
  "cropRec.whyTitle": "یہ فصل کیوں؟",
  "cropRec.soilFit": "مٹی کی مناسبت",
  "cropRec.waterRequirement": "پانی کی ضرورت",
  "cropRec.weatherFit": "موسم کی مناسبت",
  "cropRec.keyConsiderations": "اہم نکات",
  "cropRec.confidence": "{n}% اعتماد",
  "cropRec.suit.high": "انتہائی موزوں",
  "cropRec.suit.moderate": "معتدل موزوں",
  "cropRec.suit.low": "کم موزوں",
  "cropRec.advisoryNote":
    "یہ صرف مشاورتی، تخمینی سفارشات ہیں جو دستیاب فارم معلومات پر مبنی ہیں — پیداوار، منافع یا کامیابی کی کوئی ضمانت نہیں۔ بڑے فیصلوں سے پہلے مقامی زرعی مشورہ لیں۔",
  "cropRec.limitationsTitle": "نوٹس اور حدود",
  "cropRec.weatherUnavailable":
    "موسم کی معلومات فی الحال دستیاب نہیں۔ سفارشات دیگر دستیاب فارم معلومات کی بنیاد پر دی گئی ہیں۔",
  "cropRec.missingTitle": "ہمیں تھوڑی مزید معلومات چاہیے",
  "cropRec.missingDesc":
    "تھوڑی مزید معلومات ہمیں ایسی فصلیں تجویز کرنے میں مدد دے گی جو آپ کے فارم کے لیے موزوں ہو سکتی ہیں۔ درج ذیل پر معلومات درکار ہیں:",
  "cropRec.updateProfile": "فارم پروفائل اپ ڈیٹ کریں",
  "cropRec.errorTitle": "ہم ابھی فصل کی سفارشات نہیں بنا سکے",
  "cropRec.errorDesc": "براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔ آپ کی فارم معلومات محفوظ ہے۔",
  "cropRec.retry": "دوبارہ کوشش کریں",
  "cropRec.historyTitle": "پچھلی سفارشات",
  "cropRec.historySub": "آپ کے فارم کے لیے محفوظ شدہ فصل سفارش کے ریکارڈ",
  "cropRec.noHistory": "ابھی کوئی فصل سفارش نہیں",
  "cropRec.noHistoryDesc":
    "جب آپ فصل کی سفارش درخواست کریں گے تو محفوظ نتائج یہاں ظاہر ہوں گے۔",
  "cropRec.reportedOn": "تخلیق {date}",
  "cropRec.viewReport": "تفصیل دیکھیں",
  "weather.title": "موسمی معلومات",
  "risks.title": "فارم کے خطرات",
  "yield.title": "پیداوار کی پیش گوئی",
  "actions.title": "آج کے کام",
  "farmProfile.title": "فارم پروفائل",
  "farmProfile.subtitle": "آپ کے فارم کی تفصیلات اور ترتیبات",
  "diagnosisHistory.title": "تشخیص کی تاریخ",
  "chatHistory.title": "چیٹ کی تاریخ",
  "chatHistory.subtitle": "پچھلی گفتگو",

  /* ---------- Authentication ---------- */
  "auth.brandSubtitle": "آپ کا اے آئی فارمنگ فیصلہ اسسٹنٹ",
  "auth.loginTitle": "خوش آمدید",
  "auth.loginSubtitle": "اپنے کسان اے آئی اکاؤنٹ میں لاگ ان کریں۔",
  "auth.signupTitle": "اپنا اکاؤنٹ بنائیں",
  "auth.signupSubtitle": "اپنے فارم کو منظم کرنے کے لیے کسان اے آئی اکاؤنٹ بنائیں۔",
  "auth.forgotTitle": "اپنا پاس ورڈ دوبارہ ترتیب دیں",
  "auth.forgotSubtitle": "اپنا ای میل درج کریں، ہم آپ کو ری سیٹ لنک بھیجیں گے۔",
  "auth.resetTitle": "نیا پاس ورڈ منتخب کریں",
  "auth.resetSubtitle": "اپنے اکاؤنٹ کے لیے مضبوط نیا پاس ورڈ درج کریں۔",
  "auth.email": "ای میل",
  "auth.emailPlaceholder": "you@example.com",
  "auth.password": "پاس ورڈ",
  "auth.passwordPlaceholder": "آپ کا پاس ورڈ",
  "auth.confirmPassword": "پاس ورڈ کی توثیق",
  "auth.confirmPasswordPlaceholder": "پاس ورڈ دوبارہ لکھیں",
  "auth.newPassword": "نیا پاس ورڈ",
  "auth.newPasswordPlaceholder": "آپ کا نیا پاس ورڈ",
  "auth.showPassword": "پاس ورڈ دکھائیں",
  "auth.hidePassword": "پاس ورڈ چھپائیں",
  "auth.login": "لاگ ان",
  "auth.signup": "اکاؤنٹ بنائیں",
  "auth.signingIn": "لاگ ان ہو رہا ہے…",
  "auth.signingUp": "اکاؤنٹ بن رہا ہے…",
  "auth.sendReset": "ری سیٹ لنک بھیجیں",
  "auth.sendingReset": "ری سیٹ لنک بھیجا جا رہا ہے…",
  "auth.updatePassword": "پاس ورڈ تبدیل کریں",
  "auth.updatingPassword": "پاس ورڈ تبدیل ہو رہا ہے…",
  "auth.logout": "لاگ آؤٹ",
  "auth.forgotPassword": "پاس ورڈ بھول گئے؟",
  "auth.noAccount": "اکاؤنٹ نہیں ہے؟",
  "auth.haveAccount": "پہلے سے اکاؤنٹ ہے؟",
  "auth.createAccount": "اکاؤنٹ بنائیں",
  "auth.backToLogin": "لاگ ان پر واپس",
  "auth.rememberFor": "اس ڈیوائس پر سائن ان رہے گا۔",
  "auth.languageNote": "زبان اور تھیم آپ کی ویزیٹ سے محفوظ ہیں۔",
  "auth.confirmEmailTitle": "اپنا ای میل چیک کریں",
  "auth.confirmEmailBody":
    "ہم نے {email} پر تصدیقی لنک بھیج دیا ہے۔ براہ کرم اسے کھول کر اپنا ایڈریس تصدیق کریں، پھر لاگ ان ہوں۔",
  "auth.emailSent": "اپنا ای میل چیک کریں",
  "auth.emailSentBody":
    "اگر {email} کسی اکاؤنٹ سے تعلق رکھتا ہے تو پاس ورڈ ری سیٹ لنک راستے میں ہے۔ نیا پاس ورڈ منتخب کرنے کے لیے اس پر عمل کریں۔",
  "auth.resetSuccess": "پاس ورڈ تبدیل ہو گیا!",
  "auth.resetSuccessBody": "آپ کا پاس ورڈ تبدیل ہو چکا ہے۔ نئے پاس ورڈ سے لاگ ان کریں۔",
  "auth.loadingSession": "آپ کا سیشن لوڈ ہو رہا ہے…",
  "auth.errEmailRequired": "براہ کرم اپنا ای میل ایڈریس درج کریں۔",
  "auth.errEmailInvalid": "براہ کرم درست ای میل ایڈریس درج کریں۔",
  "auth.errPasswordRequired": "براہ کرم اپنا پاس ورڈ درج کریں۔",
  "auth.errPasswordTooShort": "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔",
  "auth.errPasswordMismatch": "پاس ورڈ آپس میں نہیں ملتے۔",
  "auth.errConfirmRequired": "براہ کرم اپنا پاس ورڈ تصدیق کریں۔",
  "auth.errGeneric": "کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔",
  "auth.errInvalidCredentials": "غلط ای میل یا پاس ورڈ۔ براہ کرم دوبارہ کوشش کریں۔",
  "auth.errEmailTaken": "اس ای میل کے ساتھ اکاؤنٹ پہلے سے موجود ہے۔",
  "auth.errResetFailed": "ہم آپ کا پاس ورڈ دوبارہ ترتیب نہیں کر سکے۔ براہ کرم دوبارہ کوشش کریں۔",
  "auth.redirDashboard": "آپ کو ڈیش بورڈ پر لے جا رہے ہیں…",
  "auth.redirectLogin": "لاگ ان پر واپس",
  "auth.signupApproach": "سائن ان کے بعد اپنا فارم بنائیں۔",
};

export const translations: Record<Language, Dict> = { en, ur };

/** Translate a key into the active language, falling back to English. */
export function translate(
  lang: Language,
  key: string,
  vars?: Record<string, string | number>
): string {
  let text = translations[lang][key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Default language. The Preferences provider persists the user's choice. */
export const DEFAULT_LANGUAGE: Language = "en";