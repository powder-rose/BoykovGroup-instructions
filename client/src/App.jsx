import {
  useEffect,
  useLayoutEffect
} from "react";

import {
  useDispatch
} from "react-redux";

import {
  Route,
  Routes,
  useLocation
} from "react-router-dom";

import HomePage
  from "./pages/HomePage/HomePage.jsx";

import InstructionsCatalog
  from "./components/InstructionCatalog/InstructionsCatalog.jsx";

import UrgentGenerationPage
  from "./components/UrgentGenerationPage/UrgentGenerationPage.jsx";

import InstructionPage
  from "./components/InstructionPage/InstructionPage.jsx";

import SiteFooter
  from "./components/SiteFooter/SiteFooter.jsx";

import CookieConsent
  from "./components/CookieConsent/CookieConsent.jsx";

import VisitorTracker
  from "./components/VisitorTracker/VisitorTracker.jsx";

import {
  restoreSession
} from "./store/authSlice.js";


export default function App() {

  const dispatch =
    useDispatch();

  const location =
    useLocation();


  useEffect(() => {

    dispatch(
      restoreSession()
    );

  }, [
    dispatch
  ]);


  useLayoutEffect(() => {

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });

    document.documentElement.scrollTop =
      0;

    document.body.scrollTop =
      0;

  }, [
    location.pathname
  ]);


  return (
    <>

      <VisitorTracker />


      <Routes>

        <Route
          path="/"
          element={
            <HomePage />
          }
        />


        <Route
          path="/instrukcii-po-ohrane-truda"
          element={
            <InstructionsCatalog />
          }
        />


        <Route
          path="/srochnaya-generaciya-instrukcii"
          element={
            <UrgentGenerationPage />
          }
        />


        <Route
          path="/instrukciya-po-ohrane-truda/:id"
          element={
            <InstructionPage />
          }
        />

      </Routes>


      <SiteFooter />

      <CookieConsent />

    </>
  );

}
