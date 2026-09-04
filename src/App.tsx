import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FarmProvider } from "./context/FarmContext";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { SupabaseSetupScreen } from "./components/auth/SupabaseSetupScreen";
import { supabaseReady } from "./lib/supabase";
import { LoadingState } from "./components/layout/loading-state";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FarmSetupPage from "./pages/FarmSetupPage";
import DashboardPage from "./pages/DashboardPage";

// Lazy-loaded app pages — code-split per route for faster initial paint.
const CropDoctorPage = React.lazy(() => import("./pages/CropDoctorPage"));
const CropRecommendationPage = React.lazy(() => import("./pages/CropRecommendationPage"));
const AssistantPage = React.lazy(() => import("./pages/AssistantPage"));
const WeatherPage = React.lazy(() => import("./pages/WeatherPage"));
const IrrigationPage = React.lazy(() => import("./pages/IrrigationPage"));
const RisksPage = React.lazy(() => import("./pages/RisksPage"));
const YieldPage = React.lazy(() => import("./pages/YieldPage"));
const ActionsPage = React.lazy(() => import("./pages/ActionsPage"));
const DiagnosisHistoryPage = React.lazy(() => import("./pages/DiagnosisHistoryPage"));
const FarmProfilePage = React.lazy(() => import("./pages/FarmProfilePage"));
const ExpensesPage = React.lazy(() => import("./pages/ExpensesPage"));
const CropCalendarPage = React.lazy(() => import("./pages/CropCalendarPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));

/** Wraps a lazy component in Suspense + ErrorBoundary for use as a route element. */
function lazyEl(LazyComponent: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingState rows={3} title="Loading…" />
          </div>
        }
      >
        <LazyComponent />
      </React.Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    // Auth must wrap Farm so the farm provider can observe the session and
    // scope its data to the authenticated owner.
    <AuthProvider>
      <FarmProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            {/* Public — the landing page never needs the database, so it must
                stay reachable even when Supabase isn't configured yet. */}
            <Route path="/" element={<LandingPage />} />

            {supabaseReady ? (
              <>
                {/* Auth (public) */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected app (authentication required) */}
                <Route element={<RequireAuth />}>
                  <Route element={<AppLayout />}>
                    <Route path="/farm-setup" element={<FarmSetupPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/crop-doctor" element={lazyEl(CropDoctorPage)} />
                    <Route path="/crop-recommendation" element={lazyEl(CropRecommendationPage)} />
                    <Route path="/assistant" element={lazyEl(AssistantPage)} />
                    <Route path="/voice" element={<Navigate to="/assistant" replace />} />
                    <Route path="/weather" element={lazyEl(WeatherPage)} />
                    <Route path="/irrigation" element={lazyEl(IrrigationPage)} />
                    <Route path="/risks" element={lazyEl(RisksPage)} />
                    <Route path="/yield" element={lazyEl(YieldPage)} />
                    <Route path="/actions" element={lazyEl(ActionsPage)} />
                    <Route path="/diagnosis-history" element={lazyEl(DiagnosisHistoryPage)} />
                    <Route path="/chat-history" element={<Navigate to="/assistant" replace />} />
                    <Route path="/farm-profile" element={lazyEl(FarmProfilePage)} />
                    <Route path="/expenses" element={lazyEl(ExpensesPage)} />
                    <Route path="/crop-calendar" element={lazyEl(CropCalendarPage)} />
                    <Route path="/settings" element={lazyEl(SettingsPage)} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              /* Everything beyond the landing page needs the database — show a
                 friendly setup screen instead of a white screen while the
                 Supabase integration is unconfigured. */
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="*" element={<SupabaseSetupScreen />} />
              </>
            )}
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </FarmProvider>
    </AuthProvider>
  );
}