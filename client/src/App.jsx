import { useEffect, useLayoutEffect } from 'react';

import { useDispatch } from 'react-redux';
import { WalletBalanceProvider } from './contexts/WalletBalanceContext.jsx';

import { Route, Routes, useLocation } from 'react-router-dom';

import HomePage from './pages/HomePage/HomePage.jsx';
import WalletPaymentPage from './pages/WalletPaymentPage/WalletPaymentPage.jsx';

import InstructionsCatalog from './components/InstructionCatalog/InstructionsCatalog.jsx';
import TaxonomyLandingPage from './components/TaxonomyLandingPage/TaxonomyLandingPage.jsx';
import SEO from './components/SEO/SEO.jsx';

import UrgentGenerationPage from './components/UrgentGenerationPage/UrgentGenerationPage.jsx';

import InstructionPage from './components/InstructionPage/InstructionPage.jsx';

import SiteFooter from './components/SiteFooter/SiteFooter.jsx';

import CookieConsent from './components/CookieConsent/CookieConsent.jsx';
import CompanyProfileOnboarding from './components/CompanyProfile/CompanyProfileOnboarding.jsx';

import VisitorTracker from './components/VisitorTracker/VisitorTracker.jsx';

import { restoreSession } from './store/authSlice.js';

export default function App() {
  const dispatch = useDispatch();

  const location = useLocation();

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  useLayoutEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });

    document.documentElement.scrollTop = 0;

    document.body.scrollTop = 0;
  }, [location.pathname]);

  return (
    <WalletBalanceProvider>
      <VisitorTracker />

      <Routes>
        <Route
          path="/"
          element={
            <>
              <SEO
                title="Инструкции по охране труда | БОЙКОВГРУПП"
                description="Инструкции по охране труда для работников различных профессий и видов работ. Требования безопасности и порядок выполнения работ."
                canonical="/"
                robots={location.search ? 'noindex, follow' : undefined}
              />
              <HomePage />
            </>
          }
        />
        <Route path="/oplata-instrukcii" element={<WalletPaymentPage />} />

        <Route path="/instrukcii-po-ohrane-truda" element={<InstructionsCatalog />} />
        <Route path="/instrukcii-po-ohrane-truda/*" element={<TaxonomyLandingPage />} />

        <Route path="/srochnaya-generaciya-instrukcii" element={<UrgentGenerationPage />} />

        <Route path="/instrukciya-po-ohrane-truda/:id" element={<InstructionPage />} />
      </Routes>

      <SiteFooter />

      <CookieConsent />

      <CompanyProfileOnboarding />
    </WalletBalanceProvider>
  );
}
