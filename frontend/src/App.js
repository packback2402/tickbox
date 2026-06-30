import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventDetailPage from './pages/EventDetailPage';
import HomePage from './pages/HomePage';
import Navbar from './components/Navbar'; 
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentPage from './pages/PaymentPage';
import MyTicketsPage from './pages/MyTicketsPage';
import AdminPage from './pages/AdminPage';
import CategoryPage from './pages/CategoryPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import BecomePartnerPage from './pages/BecomePartnerPage';
import SeatMapPage from './pages/SeatMapPage';
import EventAnalyticsPage from './pages/EventAnalyticsPage';
import AccountProfilePage from './pages/AccountProfilePage';
import SearchResultsPage from './pages/SearchResultsPage';
import WaitingRoomPage from './pages/WaitingRoomPage';
import AdminEventManagePage from './pages/AdminEventManagePage';


function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/organizer" element={<OrganizerDashboard />} />
          <Route path="/become-partner" element={<BecomePartnerPage />} />
          <Route path="/events/:id/seatmap" element={<SeatMapPage />} />
          <Route path="/organizer/event/:id/analytics" element={<EventAnalyticsPage />} />
          <Route path="/account" element={<AccountProfilePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/waiting-room" element={<WaitingRoomPage />} />
          <Route path="/admin/events/:id/manage" element={<AdminEventManagePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;