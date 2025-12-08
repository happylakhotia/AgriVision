import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/authcontext/Authcontext'
import Landing from './components/landing/Landing'
import Login from './components/auth/login/Login'
import Register from './components/auth/register/Register'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Header from './components/header/Header'
import FarmSelection from "./pages/FarmSelection";
import Features from "./pages/Features";
import Alerts from "./pages/Alerts";
import LiveCheck from './pages/LiveCheck'
import PestScanner from './pages/PestScanner'
import SoilAnalysis from './pages/SoilAnalysis'
import './App.css'


function App() {
  return (
    <AuthProvider>
      <Router>
        <Header />
        <Routes>
          console.log("entered routes")
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          console.log("entered landing")
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/farm-selection" element={<FarmSelection />} />
          <Route path="/features" element={<Features />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/disease-detection" element={<LiveCheck/>}/>
          <Route path="/pest-scanner" element={<PestScanner/>}/>
          <Route path="/soil-analysis" element={<SoilAnalysis/>}/>

          {/* Catch all - redirect to landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
