import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Layout from "./components/Layout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import Home from "./pages/Home";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import CreateListing from "./pages/CreateListing";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminListings from "./pages/admin/AdminListings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminSecurity from "./pages/admin/AdminSecurity";

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <CurrencyProvider>
      <AuthProvider>
        <FavoritesProvider>
          <AdminAuthProvider>
            <Toaster position="top-right" />
            <Routes>
              {/* Public user routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout><Home /></Layout>} />
              <Route path="/listings" element={<Layout><Listings /></Layout>} />
              <Route path="/c/:slug" element={<Layout><Listings /></Layout>} />
              <Route path="/listings/new" element={<Layout><CreateListing /></Layout>} />
              <Route path="/listings/:id" element={<Layout><ListingDetail /></Layout>} />
              <Route path="/listings/:id/edit" element={<Layout><CreateListing /></Layout>} />
              <Route path="/messages" element={<Layout><Messages /></Layout>} />
              <Route path="/messages/:convId" element={<Layout><Messages /></Layout>} />
              <Route path="/profile/:userId" element={<Layout><Profile /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="/contact" element={<Layout><Contact /></Layout>} />

              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
              <Route path="/admin/listings" element={<AdminProtectedRoute><AdminListings /></AdminProtectedRoute>} />
              <Route path="/admin/users" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
              <Route path="/admin/reports" element={<AdminProtectedRoute><AdminReports /></AdminProtectedRoute>} />
              <Route path="/admin/messages" element={<AdminProtectedRoute><AdminMessages /></AdminProtectedRoute>} />
              <Route path="/admin/security" element={<AdminProtectedRoute><AdminSecurity /></AdminProtectedRoute>} />
            </Routes>
          </AdminAuthProvider>
        </FavoritesProvider>
      </AuthProvider>
      </CurrencyProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
