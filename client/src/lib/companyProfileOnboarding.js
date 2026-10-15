export const COMPANY_ONBOARDING_KEY = 'boykovdocs_company_onboarding_user_v1';

export function pendingCompanyProfileUserId() {
  try {
    return window.sessionStorage.getItem(COMPANY_ONBOARDING_KEY);
  } catch {
    return null;
  }
}

export function markCompanyProfileOnboarding(userId) {
  if (!userId) return;
  try {
    window.sessionStorage.setItem(COMPANY_ONBOARDING_KEY, String(userId));
  } catch {
    // The Redux flag still offers the form in the current page.
  }
}

export function clearCompanyProfileOnboarding(userId) {
  try {
    if (window.sessionStorage.getItem(COMPANY_ONBOARDING_KEY) === String(userId)) {
      window.sessionStorage.removeItem(COMPANY_ONBOARDING_KEY);
    }
  } catch {
    // No company information is stored in browser storage.
  }
}
