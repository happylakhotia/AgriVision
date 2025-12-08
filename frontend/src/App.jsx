import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/authcontext/Authcontext'
import { SidebarProvider } from './contexts/sidebarcontext/SidebarContext'
import Landing from './components/landing/Landing'
import Login from './components/auth/login/Login'
import Register from './components/auth/register/Register'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Header from './components/header/Header'
import FarmSelection from "./pages/FarmSelection";
import Features from "./pages/Features";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import LiveCheck from './pages/LiveCheck'
import PestScanner from './pages/PestScanner'
import SoilAnalysis from './pages/SoilAnalysis'
import Logistics from './pages/Logistics'
import Insurance from './pages/Insurance'
import Machinery from './pages/Machinery'
import FindCustomers from './pages/FindCustomers'
import VendorDashboard from './pages/VendorDashboard'
import VendorOpportunities from './pages/VendorOpportunities'
import UserTypeSelection from './components/auth/UserTypeSelection'
import Chat from './pages/Chat'
import Reports from './pages/Reports'
import './App.css'


function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <Router>
          <Header />
        <Routes>
          console.log("entered routes")
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          console.log("entered landing")
          <Route path="/user-type" element={<UserTypeSelection />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/farm-selection" element={<FarmSelection />} />
          <Route path="/features" element={<Features />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/disease-detection" element={<LiveCheck/>}/>
          <Route path="/pest-scanner" element={<PestScanner/>}/>
          <Route path="/soil-analysis" element={<SoilAnalysis/>}/>
          <Route path="/logistics" element={<Logistics/>}/>
          <Route path="/insurance" element={<Insurance/>}/>
          <Route path="/machinery" element={<Machinery/>}/>
          <Route path="/find-customers" element={<FindCustomers/>}/>
          <Route path="/vendor-dashboard" element={<VendorDashboard/>}/>
          <Route path="/vendor-opportunities" element={<VendorOpportunities/>}/>
          <Route path="/reports" element={<Reports/>}/>
          <Route path="/chat/:otherUserId" element={<Chat/>}/>

          {/* Catch all - redirect to landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </SidebarProvider>
    </AuthProvider>
  )
}

export default App
