import { createCompanyProfileRepository } from './companyProfileRepository.js';
import { createCompanyProfileNotificationWorker } from './companyProfileNotificationService.js';

export const companyProfileRepository = createCompanyProfileRepository();

const notificationWorker = createCompanyProfileNotificationWorker({
  repository: companyProfileRepository,
});

export function getCompanyProfileView(userId) {
  return companyProfileRepository.getView(userId);
}

export function getCompanyProfile(userId) {
  return getCompanyProfileView(userId).companyProfile;
}

export function notifyCompanyProfileSaved() {
  notificationWorker.wake();
}

export function startCompanyProfileNotificationWorker() {
  notificationWorker.start();
}

export function stopCompanyProfileNotificationWorker() {
  return notificationWorker.stop();
}
