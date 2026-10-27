import { createCloudKassirApi } from './cloudKassirApiService.js';
import { createFiscalReceiptRepository } from './fiscalReceiptRepository.js';
import { createFiscalReceiptWorker } from './fiscalReceiptWorker.js';
import { walletRepository } from './walletRepository.js';
import { listPublicGenerationFiscalEvents } from './publicGenerationOrderService.js';

export const fiscalReceiptRepository = createFiscalReceiptRepository();
export const fiscalReceiptWorker = createFiscalReceiptWorker({
  repository: fiscalReceiptRepository,
  api: createCloudKassirApi(),
  getEvents: () =>
    [() => walletRepository.listFiscalEvents(), listPublicGenerationFiscalEvents].flatMap(read => {
      try {
        return read();
      } catch (error) {
        console.error('[FiscalReceipt] source unavailable', error.code || 'FISCAL_SOURCE_INVALID');
        return [];
      }
    }),
});
