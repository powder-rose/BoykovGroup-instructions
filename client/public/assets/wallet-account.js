import {
  walletRequest,
  formatRubles,
  walletPaymentUrl,
  downloadPurchasedInstruction,
  WALLET_UPDATED_EVENT,
} from './wallet-client.js?v=20261016-wallet-v2';

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
      element('div', 'wallet-muted', 'Одна инструкция из каталога — 50 ₽'),
    );
    summary.append(balance, link('Пополнить баланс →', walletPaymentUrl(), 'wallet-button'));
    const heading = element('h2', '', 'Купленные инструкции');
    const status = element('p', 'wallet-muted');
    status.setAttribute('role', 'status');
    const list = element('div', 'account-wallet__list');
    for (const purchase of wallet.purchases) {
      const row = element('article', 'account-wallet__item');
      const info = element('div');
      info.append(
        element('h3', '', purchase.title),
        element(
          'div',
          'wallet-muted',
          `${formatDate(purchase.createdAt)} · Повторное скачивание бесплатно`,
        ),
      );
      const button = element('button', 'wallet-button wallet-button--secondary', 'Скачать PDF');
      button.type = 'button';
      button.addEventListener('click', async () => {
        if (!current() || downloading) return;
        downloading = true;
        button.disabled = true;
        button.textContent = 'Готовим PDF…';
        status.textContent = '';
        try {
          await downloadPurchasedInstruction(token, purchase.id, { signal: lifetime.signal });
          if (current()) status.textContent = 'PDF готов к сохранению.';
        } catch (error) {
          if (current()) {
            if (error.status === 401) onAuthenticationError();
            else status.textContent = error.message;
          }
        } finally {
          downloading = false;
          if (current()) {
            button.disabled = false;
            button.textContent = 'Скачать PDF';
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
          'Здесь появятся инструкции, которые вы купите после окончания бесплатных скачиваний.',
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
            : item.title;
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
    root.replaceChildren(summary);
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
