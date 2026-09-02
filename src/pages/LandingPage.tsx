import { LandingNavbar } from "../components/landing/landing-navbar";
import { LandingHero } from "../components/landing/landing-hero";
import { LandingProblem } from "../components/landing/landing-problem";
import { LandingSolution } from "../components/landing/landing-solution";
import { LandingFeatures } from "../components/landing/landing-features";
import { LandingHowItWorks } from "../components/landing/landing-how-it-works";
import { LandingTestimonials } from "../components/landing/landing-testimonials";
import { LandingFaq } from "../components/landing/landing-faq";
import { LandingContact } from "../components/landing/landing-contact";
import { LandingFooter } from "../components/landing/landing-footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingProblem />
        <LandingSolution />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials />
        <LandingFaq />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}