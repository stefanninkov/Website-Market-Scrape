import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Sweeps from './pages/Sweeps';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Settings from './pages/Settings';
import SignIn from './pages/SignIn';

function Gate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="font-mono text-sm text-text-dim">loading…</span>
      </div>
    );
  }

  if (status !== 'signed_in') {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="sweeps" element={<Sweeps />} />
        <Route path="leads" element={<Leads />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
