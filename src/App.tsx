import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FarmProvider } from "./context/FarmContext";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth } from "./components/auth/RequireAuth";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FarmSetupPage from "./pages/FarmSetupPage";
import DashboardPage from "./pages/DashboardPage";
import CropDoctorPage from "./pages/CropDoctorPage";
import CropRecommendationPage from "./pages/CropRecommendationPage";
import AssistantPage from "./pages/AssistantPage";
import VoicePage from "./pages/VoicePage";
import WeatherPage from "./pages/WeatherPage";
import RisksPage from "./pages/RisksPage";
import YieldPage from "./pages/YieldPage";
import ActionsPage from "./pages/ActionsPage";
import DiagnosisHistoryPage from "./pages/DiagnosisHistoryPage";
import ChatHistoryPage from "./pages/ChatHistoryPage";
import FarmProfilePage from "./pages/FarmProfilePage";

export default function App() {
  return (
    // Auth must wrap Farm so the farm provider can observe the session and
    // scope its data to the authenticated owner.
    <AuthProvider>
      <FarmProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected app (authentication required) */}
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/farm-setup" element={<FarmSetupPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/crop-doctor" element={<CropDoctorPage />} />
                <Route path="/crop-recommendation" element={<CropRecommendationPage />} />
                <Route path="/assistant" element={<AssistantPage />} />
                <Route path="/voice" element={<VoicePage />} />
                <Route path="/weather" element={<WeatherPage />} />
                <Route path="/risks" element={<RisksPage />} />
                <Route path="/yield" element={<YieldPage />} />
                <Route path="/actions" element={<ActionsPage />} />
                <Route path="/diagnosis-history" element={<DiagnosisHistoryPage />} />
                <Route path="/chat-history" element={<ChatHistoryPage />} />
                <Route path="/farm-profile" element={<FarmProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </FarmProvider>
    </AuthProvider>
  );
}