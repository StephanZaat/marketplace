import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Layout from "./components/Layout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import PageViewTracker from "./components/PageViewTracker";
// Home stays in the main bundle for first paint; every other route is its own
// chunk, so visitors never download admin or messaging code they don't use.
import Home from "./pages/Home";

const Listings = lazy(() => import("./pages/Listings"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const Messages = lazy(() => import("./pages/Messages"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminListings = lazy(() => import("./pages/admin/AdminListings"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminInsights = lazy(() => import("./pages/admin/AdminInsights"));
const AdminVisitors = lazy(() => import("./pages/admin/AdminVisitors"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminListingEdit = lazy(() => import("./pages/admin/AdminListingEdit"));

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <CurrencyProvider>
      <AuthProvider>
        <FavoritesProvider>
          <AdminAuthProvider>
            <Toaster position="top-right" />
            <PageViewTracker />
            <Suspense fallback={null}>
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
              <Route path="/admin/insights" element={<AdminProtectedRoute><AdminInsights /></AdminProtectedRoute>} />
              <Route path="/admin/visitors" element={<AdminProtectedRoute><AdminVisitors /></AdminProtectedRoute>} />
              <Route path="/admin/categories" element={<AdminProtectedRoute><AdminCategories /></AdminProtectedRoute>} />
              <Route path="/admin/users/:userId" element={<AdminProtectedRoute><AdminUserDetail /></AdminProtectedRoute>} />
              <Route path="/admin/listings/:listingId" element={<AdminProtectedRoute><AdminListingEdit /></AdminProtectedRoute>} />
            </Routes>
            </Suspense>
          </AdminAuthProvider>
        </FavoritesProvider>
      </AuthProvider>
      </CurrencyProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
