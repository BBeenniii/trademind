import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AiSummaryPage } from './pages/AiSummaryPage';
import { AlertsPage } from './pages/AlertsPage';
import { BacktestPage } from './pages/BacktestPage';
import { LivePage } from './pages/LivePage';
import { ModelLifecyclePage } from './pages/ModelLifecyclePage';
import { OverviewPage } from './pages/OverviewPage';
import { SignalsPage } from './pages/SignalsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/live" replace />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/backtest" element={<BacktestPage />} />
        <Route path="/ai-summary" element={<AiSummaryPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/models" element={<ModelLifecyclePage />} />
      </Route>
    </Routes>
  );
}