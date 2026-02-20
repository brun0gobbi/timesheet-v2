import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginView from './views/LoginView';

import Home from './views/Home';
import GeneralDashboard from './views/GeneralDashboard';
import CollaboratorView from './views/CollaboratorView';
import ClientView from './views/ClientView';
import AIView from './views/AIView';
import { AuditView } from './views/AuditView';
import ComparisonView from './views/ComparisonView';
import StrategicActivity from './views/StrategicActivity';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><GeneralDashboard /></ProtectedRoute>} />
          <Route path="/colaborador" element={<ProtectedRoute><CollaboratorView /></ProtectedRoute>} />
          <Route path="/cliente" element={<ProtectedRoute><ClientView /></ProtectedRoute>} />
          <Route path="/atividades" element={<ProtectedRoute><StrategicActivity /></ProtectedRoute>} />
          <Route path="/ia" element={<ProtectedRoute><AIView /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditView /></ProtectedRoute>} />
          <Route path="/comparativo" element={<ProtectedRoute><ComparisonView /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
