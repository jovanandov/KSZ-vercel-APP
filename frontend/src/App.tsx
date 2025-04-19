import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Layout from './components/Layout';
import Checklist from './pages/Checklist';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import StartChecklist from './pages/StartChecklist';
import { useAuth } from './context/AuthContext';
import { ChecklistProvider } from './context/ChecklistContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChecklistProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StartChecklist />} />
            <Route path="checklist/:tipId/:projektId/:ponovitevId" element={<Checklist />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </ChecklistProvider>
    </ThemeProvider>
  );
};

export default App; 