import 'dotenv/config';
import { getFiscalConfiguration } from '../src/services/fiscalReceiptPayload.js';
import { createCloudKassirApi } from '../src/services/cloudKassirApiService.js';
import { createFiscalReceiptRepository } from '../src/services/fiscalReceiptRepository.js';

try {
  const configuration = getFiscalConfiguration();
  if (!configuration) {
    console.log('FISCALIZATION=disabled');
    process.exitCode = 1;
  } else {
    const entries = createFiscalReceiptRepository().list();
    const counts = Object.fromEntries(
      ['pending', 'sending', 'submitted', 'processed', 'review'].map(status => [
        status,
        entries.filter(entry => entry.status === status).length,
      ]),
    );
    console.log('FISCALIZATION=enabled');
    console.log('SNO=USN_INCOME VAT=5 ADVANCE_VAT=5/105');
    console.log(JSON.stringify(counts));
    for (const entry of entries.filter(row => row.status === 'review'))
      console.log(`REVIEW=${entry.event.id} REASON=${entry.lastError}`);
    if (process.argv.includes('--check-api')) {
      await createCloudKassirApi().test();
      console.log('CLOUDKASSIR_API_AUTH=OK');
    }
    if (process.argv.includes('--check-register')) {
      const device = String(process.env.CLOUDKASSIR_DEVICE_NUMBER || '').trim();
      const fiscal = String(process.env.CLOUDKASSIR_FISCAL_NUMBER || '').trim();
      if (!device || !fiscal)
        throw Object.assign(new Error(), { code: 'FISCAL_REGISTER_IDENTIFIERS_REQUIRED' });
      const { Model: register } = await createCloudKassirApi().register(device, fiscal);
      const expectedHost = new URL(configuration.policy.place).hostname.toLowerCase();
      const places = String(register?.CalculationPlace || '')
        .toLowerCase()
        .split(/[^a-z0-9.-]+/u);
      if (
        String(register?.Inn) !== configuration.policy.inn ||
        register?.Fiscal !== true ||
        register.Status !== 1 ||
        register.IsBso !== false
      )
        throw Object.assign(new Error(), { code: 'FISCAL_REGISTER_NOT_READY' });
      if (!places.includes(expectedHost))
        throw Object.assign(new Error(), { code: 'FISCAL_REGISTER_SITE_NOT_LISTED' });
      console.log('CLOUDKASSIR_REGISTER=OK');
    }
    if (counts.review) process.exitCode = 2;
  }
} catch (error) {
  console.error('FISCAL_CHECK_FAILED', error.code || 'FISCAL_CONFIGURATION_OR_STORAGE_INVALID');
  process.exitCode = 1;
}
