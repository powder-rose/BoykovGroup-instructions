import { getCompanyProfile } from './companyProfileService.js';
import { getUserById } from './userService.js';

export function getInstructionPdfCompanyProfile(
  user,
  { userLookup = getUserById, profileLookup = getCompanyProfile } = {},
) {
  if (user?.role !== 'user' || !user.sub || !userLookup(user.sub)) {
    return null;
  }

  return profileLookup(user.sub);
}
