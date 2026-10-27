import {
  walletRequest,
  formatRubles,
  walletPaymentUrl,
  downloadPurchasedInstruction,
  WALLET_UPDATED_EVENT,
} from './wallet-client.js?v=word-download';
import { quotaScheduleCopy } from './wallet-quota-view.js?v=20261020-monthly-quota';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(text, href, className = 'wallet-text-link') {
  const node = element('a', className, text);
  node.href = href;
  return node;
}

const formatDate = value =>
  new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export function mountAccountWallet(root, { getToken, onAuthenticationError }) {
  const token = getToken();
  const headerBalance = document.getElementById('account-header-balance');
  const lifetime = new AbortController();
  let request;
  let quotaRequest;
  let downloading = false;
  const current = () => !lifetime.signal.aborted && token === getToken();
  root.className = 'account-wallet wallet-panel';
  root.textContent = 'Загружаем баланс…';

  function render(wallet) {
    const summary = element('div', 'account-wallet__summary');
    const balance = element('div');
    balance.append(
      element('div', 'wallet-eyebrow', '[ ВАШ БАЛАНС ]'),
      element('div', 'wallet-balance', formatRubles(wallet.balanceMinor)),
      element('div', 'wallet-muted', 'Word — 50 ₽ · PDF — по доступному лимиту'),
    );
    summary.append(balance, link('Пополнить баланс →', walletPaymentUrl(), 'wallet-button'));
    const quotaPanel = element('section', 'account-wallet__quota');
    quotaPanel.setAttribute('aria-label', 'Бесплатные скачивания');
    quotaPanel.append(
      element('div', 'wallet-eyebrow', '[ БЕСПЛАТНЫЕ ИНСТРУКЦИИ ]'),
      element('p', 'wallet-muted', 'Проверяем остаток и дату обновления…'),
    );
    const heading = element('h2', '', 'Купленные инструкции');
    const status = element('p', 'wallet-muted');
    status.setAttribute('role', 'status');
    const list = element('div', 'account-wallet__list');
    for (const purchase of wallet.purchases) {
      const format = purchase.format || 'pdf';
      const label = format === 'docx' ? 'Word' : 'PDF';
      const row = element('article', 'account-wallet__item');
      const info = element('div');
      info.append(
        element('h3', '', purchase.title),
        element(
          'div',
          'wallet-muted',
          `${label} · ${formatDate(purchase.createdAt)} · Повторное скачивание бесплатно`,
        ),
      );
      const button = element(
        'button',
        'wallet-button wallet-button--secondary',
        `Скачать ${label}`,
      );
      button.type = 'button';
      button.addEventListener('click', async () => {
        if (!current() || downloading) return;
        downloading = true;
        button.disabled = true;
        button.textContent = `Готовим ${label}…`;
        status.textContent = '';
        try {
          await downloadPurchasedInstruction(token, purchase.id, {
            signal: lifetime.signal,
            format,
          });
          if (current()) status.textContent = `${label} готов к сохранению.`;
        } catch (error) {
          if (current()) {
            if (error.status === 401) onAuthenticationError();
            else status.textContent = error.message;
          }
        } finally {
          downloading = false;
          if (current()) {
            button.disabled = false;
            button.textContent = `Скачать ${label}`;
          }
        }
      });
      row.append(info, button);
      list.append(row);
    }
    if (!wallet.purchases.length)
      list.append(
        element(
          'p',
          'wallet-muted',
          'Здесь появятся купленные PDF и Word. Повторное скачивание купленного формата бесплатно.',
        ),
      );
    const history = element('details');
    history.append(element('summary', '', 'История операций'));
    const entries = element('ul', 'account-wallet__history');
    for (const item of wallet.history) {
      const row = element('li');
      const title =
        item.type === 'topup'
          ? 'Пополнение баланса'
          : item.type === 'refund'
            ? 'Возврат платежа'
            : `${item.title} · ${item.format === 'docx' ? 'Word' : 'PDF'}`;
      row.append(
        element('span', '', `${title} · ${formatDate(item.createdAt)}`),
        element(
          'strong',
          '',
          `${item.amountMinor > 0 ? '+' : ''}${formatRubles(item.amountMinor)}`,
        ),
      );
      entries.append(row);
    }
    history.append(entries);
    if (!wallet.history.length) history.append(element('p', 'wallet-muted', 'Операций пока нет.'));
    root.replaceChildren(summary, quotaPanel);
    if (headerBalance) {
      headerBalance.textContent = `Баланс · ${formatRubles(wallet.balanceMinor)}`;
      headerBalance.hidden = false;
    }
    if (wallet.balanceMinor < 0)
      root.append(
        element(
          'p',
          'wallet-notice wallet-notice--error',
          'После возврата платежа возникла задолженность. Пополните баланс для следующих покупок.',
        ),
      );
    const pending = wallet.topups.find(order => order.status === 'pending');
    if (pending) {
      const note = element(
        'p',
        'wallet-muted',
        'Если оплата уже прошла, а деньги ещё не появились: ',
      );
      note.append(link('проверить платёж', walletPaymentUrl(null, pending.id)));
      root.append(note);
    }
    root.append(heading, list, status, history);
    void refreshQuota(quotaPanel);
  }

  async function refreshQuota(panel) {
    quotaRequest?.abort();
    const controller = new AbortController();
    quotaRequest = controller;
    try {
      const response = await fetch('/api/instructions/download-quota?schedule=1', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401) {
        if (current() && !controller.signal.aborted) onAuthenticationError();
        return;
      }
      if (!response.ok) throw new Error('Не удалось проверить лимит.');
      const copy = quotaScheduleCopy(await response.json());
      if (!copy) throw new Error('Некорректный ответ сервера.');
      if (!current() || controller.signal.aborted || !panel.isConnected) return;
      panel.replaceChildren(
        element('div', 'wallet-eyebrow', '[ БЕСПЛАТНЫЕ ИНСТРУКЦИИ ]'),
        element('strong', 'account-wallet__quota-title', copy.title),
        element('p', 'wallet-muted', copy.description),
      );
    } catch {
      if (!current() || controller.signal.aborted || !panel.isConnected) return;
      const retry = element('button', 'wallet-button wallet-button--secondary', 'Повторить');
      retry.type = 'button';
      retry.addEventListener('click', () => void refreshQuota(panel));
      panel.replaceChildren(
        element('div', 'wallet-eyebrow', '[ БЕСПЛАТНЫЕ ИНСТРУКЦИИ ]'),
        element('p', 'wallet-muted', 'Не удалось проверить остаток бесплатных скачиваний.'),
        retry,
      );
    } finally {
      if (quotaRequest === controller) quotaRequest = null;
    }
  }

  async function refresh() {
    if (!current() || downloading) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    try {
      const wallet = await walletRequest(token, '', { signal: controller.signal });
      if (current() && !controller.signal.aborted) render(wallet);
    } catch (error) {
      if (!current() || controller.signal.aborted) return;
      if (headerBalance) headerBalance.hidden = true;
      if (error.status === 401) return onAuthenticationError();
      const text = element(
        'p',
        'wallet-muted',
        'Не удалось загрузить баланс. Ваши покупки сохраняются в аккаунте.',
      );
      const retry = element('button', 'wallet-button wallet-button--secondary', 'Повторить');
      retry.type = 'button';
      retry.addEventListener('click', () => void refresh());
      root.replaceChildren(text, retry);
    }
  }
  const focus = () => void refresh();
  const visible = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  window.addEventListener('focus', focus);
  window.addEventListener('pageshow', focus);
  window.addEventListener(WALLET_UPDATED_EVENT, focus);
  document.addEventListener('visibilitychange', visible);
  void refresh();
  return {
    destroy() {
      lifetime.abort();
      request?.abort();
      quotaRequest?.abort();
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', focus);
      window.removeEventListener(WALLET_UPDATED_EVENT, focus);
      document.removeEventListener('visibilitychange', visible);
      if (headerBalance) headerBalance.hidden = true;
      root.replaceChildren();
      root.className = '';
    },
  };
}
