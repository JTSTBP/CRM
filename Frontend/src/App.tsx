import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import EmailSending from './pages/Admin/EmailSending';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Profile from './pages/Profile/Profile';
import Users from './pages/Admin/Users';
import Leads from './pages/Admin/Leads';
import Contacts from './pages/Admin/Contacts';
import ContactDetail from './pages/Admin/ContactDetail';
import AgentDashboard from './pages/AgentDashboard';
import TaskReminder from './components/TaskReminder';
import BDLayout from './components/layout/BDLayout';
import BDDashboard from './pages/BD/BDDashboard';
import BDReports from './pages/BD/BDReports';
import AddLeadTab from './pages/Admin/AddLeadTab';
import Attendance from './pages/Admin/Attendance';
import AdminReports from './pages/Admin/Reports';
import BDDailyReports from './pages/Admin/BDDailyReports';
import ManagerLayout from './components/layout/ManagerLayout';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import ManagerReports from './pages/Manager/ManagerReports';

import { Toaster } from 'react-hot-toast';

function App() {
  // Check for day-based auto-logout
  const storedDate = localStorage.getItem('loginDate');
  const today = new Date().toDateString();

  if (storedDate && storedDate !== today) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginDate');
  }

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const getRedirectPath = () => {
    if (!token || !user) return "/login";
    if (user.role === 'Admin') return "/admin/dashboard";
    if (user.role === 'Manager') return "/manager/dashboard";
    if (user.role === 'BD Executive') return "/bd/dashboard";
    return "/dashboard";
  };

  return (
    <>
      <Toaster position="top-right" />
      <Router>
        <TaskReminder />
        <Routes>
          <Route path="/" element={<Navigate to={getRedirectPath()} replace />} />
          <Route path="/login" element={<Login type="agent" />} />
          <Route path="/admin-login" element={<Login type="admin" />} />

          {/* Agent Route */}
          <Route path="/dashboard" element={getRedirectPath() === '/dashboard' ? <AgentDashboard /> : <Navigate to={getRedirectPath()} replace />} />

          {/* Manager Protected Routes */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="add-lead" element={<AddLeadTab />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="reports" element={<ManagerReports />} />
            <Route path="profile" element={<Profile />} />
            {/* Redirect /manager to /manager/dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="leads" element={<Leads />} />
            <Route path="add-lead" element={<AddLeadTab />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="bd-daily-reports" element={<BDDailyReports />} />
            <Route path="profile" element={<Profile />} />
            <Route path="email-sending" element={<EmailSending />} />
            {/* Redirect /admin to /admin/dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* BD Executive Protected Routes */}
          <Route path="/bd" element={<BDLayout />}>
            <Route path="dashboard" element={<BDDashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="add-lead" element={<AddLeadTab />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="reports" element={<BDReports />} />
            <Route path="profile" element={<Profile />} />
            <Route path="email-sending" element={<EmailSending />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;
