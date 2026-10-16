/**
 * CloudPayments allows a Pay-only setup. A disabled Check notification is valid
 * for our existing terminal because both payment flows verify signed Pay
 * notifications and reconcile transactions with the CloudPayments API.
 * Refund must remain enabled so wallet balances reflect returned funds.
 */
export function assessCloudPaymentsNotification(type, settings, expectedAddress) {
  if (type === 'check' && settings?.IsEnabled === false) {
    return { valid: true, checkDisabled: true };
  }

  const valid =
    settings?.IsEnabled === true &&
    settings.Address === expectedAddress &&
    settings.HttpMethod === 'POST' &&
    settings.Encoding === 'UTF8' &&
    settings.Format === 'CloudPayments';

  return { valid, checkDisabled: false };
}
