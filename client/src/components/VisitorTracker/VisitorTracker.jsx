import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAdmin, selectIsRestoringSession } from '../../store/authSlice.js';

const TRACKING_MODULE_URL = '/assets/visitor-tracking.js?v=traffic-filtering';

export default function VisitorTracker() {
  const location = useLocation();
  const isAdmin = useSelector(selectIsAdmin);
  const isRestoring = useSelector(selectIsRestoringSession);
  useEffect(() => {
    if (isRestoring || isAdmin) return undefined;
    let active = true;
    // One shared collector also deduplicates a legacy script on the same document.
    import(/* @vite-ignore */ TRACKING_MODULE_URL)
      .then(module => {
        if (active) return module.trackCurrentPage();
      })
      .catch(() => {
        /* Statistics must not interrupt the website. */
      });
    return () => {
      active = false;
    };
  }, [location.pathname, location.search, isAdmin, isRestoring]);
  return null;
}
