const FIELDS = [
  { name: 'companyName', label: 'Название компании', maxLength: 300 },
  { name: 'inn', label: 'ИНН', maxLength: 12 },
  { name: 'headFullName', label: 'ФИО руководителя организации', maxLength: 200 },
  { name: 'headPosition', label: 'Должность руководителя организации', maxLength: 200 },
  {
    name: 'occupationalSafetyFullName',
    label: 'ФИО ответственного по охране труда',
    maxLength: 200,
  },
  {
    name: 'occupationalSafetyPosition',
    label: 'Должность ответственного по охране труда',
    maxLength: 200,
  },
];

let formSequence = 0;

/** Shared by the registration dialog and the static personal account. */
export function mountCompanyProfileForm(
  root,
  { getToken, apiBaseUrl = '', mode = 'account', onComplete, onAuthenticationError } = {},
) {
  const document = root.ownerDocument;
  const instanceId = `company-profile-${++formSequence}`;
  const initialToken = getToken?.();
  const controllers = new Set();
  const inputs = new Map();
  const fieldErrors = new Map();
  let destroyed = false;
  let authenticationFailed = false;
  let busy = false;
  let form = null;
  let status = null;
  let saveButton = null;
  let skipButton = null;
  let loadSequence = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  const section = element('section', 'company-profile');
  section.setAttribute('aria-labelledby', `${instanceId}-title`);
  const eyebrow = element('p', 'company-profile__eyebrow', 'ДАННЫЕ ДЛЯ ИНСТРУКЦИЙ');
  const title = element(
    'h2',
    'company-profile__title',
    mode === 'onboarding' ? 'Добавьте данные компании' : 'Данные компании',
  );
  title.id = `${instanceId}-title`;
  const description = element(
    'p',
    'company-profile__description',
    'Подставим эти данные в PDF-инструкции, чтобы их было удобнее проверить и подготовить к подписанию. Все поля необязательные; их можно изменить в личном кабинете.',
  );
  const body = element('div', 'company-profile__body');
  section.append(eyebrow, title, description, body);
  root.replaceChildren(section);

  function showStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('company-profile__status--error', isError);
  }

  function stopForAuthentication() {
    if (destroyed || authenticationFailed) return;
    authenticationFailed = true;
    controllers.forEach(controller => controller.abort());
    inputs.clear();
    fieldErrors.clear();
    body.replaceChildren(
      element(
        'p',
        'company-profile__status company-profile__status--error',
        'Войдите в аккаунт заново, чтобы изменить данные компании.',
      ),
    );
    if (mode === 'onboarding') {
      const defer = element('button', 'company-profile__button', 'Продолжить без заполнения');
      defer.type = 'button';
      defer.addEventListener('click', () => {
        if (!destroyed) onComplete?.(null, { action: 'deferred' });
      });
      body.append(defer);
    }
    onAuthenticationError?.();
  }

  function isCurrent() {
    if (destroyed || authenticationFailed) return false;
    if (!initialToken || getToken?.() !== initialToken) {
      stopForAuthentication();
      return false;
    }
    return true;
  }

  async function request(method = 'GET', payload, suffix = '') {
    if (!isCurrent()) return null;
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/u, '')}/api/account/company-profile${suffix}`,
        {
          method,
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${initialToken}`,
            ...(payload ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (timedOut) throw new Error('REQUEST_TIMEOUT');
      if (!isCurrent()) return null;
      if (response.status === 401) {
        stopForAuthentication();
        return null;
      }
      if (!response.ok) {
        const error = new Error(
          typeof data.error === 'string' ? data.error : 'Не удалось сохранить данные компании.',
        );
        error.field = data.field;
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error('Сервер не ответил вовремя. Попробуйте ещё раз.');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  function setBusy(value, action = 'saved') {
    busy = value;
    form?.setAttribute('aria-busy', String(value));
    inputs.forEach(input => {
      input.disabled = value;
    });
    if (saveButton) {
      saveButton.disabled = value;
      saveButton.textContent = value && action === 'saved' ? 'Сохраняем…' : 'Сохранить данные';
    }
    if (skipButton) {
      skipButton.disabled = value;
      skipButton.textContent = value && action === 'dismissed' ? 'Пропускаем…' : 'Пропустить';
    }
  }

  function clearErrors() {
    fieldErrors.forEach(error => {
      error.textContent = '';
    });
    inputs.forEach(input => input.removeAttribute('aria-invalid'));
  }

  function showFieldError(name, message) {
    const input = inputs.get(name);
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    fieldErrors.get(name).textContent = message;
    input.focus();
  }

  async function submit(action) {
    if (busy || !isCurrent()) return;
    if (action === 'dismissed') {
      loadSequence += 1;
      controllers.forEach(controller => controller.abort());
    }
    clearErrors();
    showStatus('');
    const companyProfile = Object.fromEntries(
      [...inputs].map(([name, input]) => [name, input.value.trim()]),
    );
    if (
      action === 'saved' &&
      companyProfile.inn &&
      !/^(?:\d{10}|\d{12})$/u.test(companyProfile.inn)
    ) {
      showFieldError('inn', 'ИНН должен содержать 10 или 12 цифр.');
      showStatus('Проверьте ИНН или оставьте поле пустым.', true);
      return;
    }
    setBusy(true, action);
    try {
      const view =
        action === 'dismissed'
          ? await request('POST', undefined, '/dismiss')
          : await request('PUT', { companyProfile });
      if (!view || !isCurrent()) return;
      if (action === 'saved') {
        inputs.forEach((input, name) => {
          input.value = view.companyProfile?.[name] ?? companyProfile[name];
        });
      }
      showStatus(
        action === 'saved'
          ? 'Данные компании сохранены.'
          : 'Можно заполнить позже в личном кабинете.',
      );
      onComplete?.(view, { action });
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return;
      setBusy(false);
      showStatus(
        error.status
          ? error.message
          : 'Не удалось сохранить данные. Проверьте соединение и попробуйте ещё раз.',
        true,
      );
      if (error.field) showFieldError(error.field, error.message);
      if (action === 'dismissed') offerDeferred();
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function offerDeferred() {
    if (mode !== 'onboarding' || body.querySelector('[data-company-profile-defer]')) return;
    const defer = element('button', 'company-profile__button', 'Продолжить без заполнения');
    defer.type = 'button';
    defer.dataset.companyProfileDefer = 'true';
    defer.addEventListener('click', () => {
      if (busy || !isCurrent()) return;
      onComplete?.(null, { action: 'deferred' });
    });
    body.append(defer);
  }

  function renderForm(view) {
    if (mode === 'onboarding' && view.onboardingCompletedAt) {
      body.replaceChildren(
        element('p', 'company-profile__status', 'Данные компании доступны в личном кабинете.'),
      );
      onComplete?.(view, { action: 'already-completed' });
      return;
    }
    form = element('form', 'company-profile__form');
    form.noValidate = true;
    const grid = element('div', 'company-profile__fields');
    for (const { name, label, maxLength } of FIELDS) {
      const field = element('div', 'company-profile__field');
      const inputId = `${instanceId}-${name}`;
      const labelNode = element('label', 'company-profile__label', label);
      labelNode.htmlFor = inputId;
      const input = element('input', 'company-profile__input');
      input.id = inputId;
      input.name = name;
      input.type = 'text';
      input.maxLength = maxLength;
      input.autocomplete = name === 'companyName' ? 'organization' : 'off';
      if (name === 'inn') input.inputMode = 'numeric';
      input.value = view.companyProfile?.[name] ?? '';
      const error = element('span', 'company-profile__field-error');
      error.id = `${inputId}-error`;
      input.setAttribute('aria-describedby', error.id);
      input.addEventListener('input', () => {
        if (!isCurrent()) return;
        error.textContent = '';
        input.removeAttribute('aria-invalid');
        showStatus('');
      });
      inputs.set(name, input);
      fieldErrors.set(name, error);
      field.append(labelNode, input, error);
      grid.append(field);
    }
    const notice = element(
      'p',
      'company-profile__notice',
      'При сохранении данные компании передаются команде БОЙКОВГРУПП.',
    );
    const actions = element('div', 'company-profile__actions');
    saveButton = element(
      'button',
      'company-profile__button company-profile__button--primary',
      'Сохранить данные',
    );
    saveButton.type = 'submit';
    actions.append(saveButton);
    if (mode === 'onboarding') {
      skipButton = element('button', 'company-profile__button', 'Пропустить');
      skipButton.type = 'button';
      skipButton.addEventListener('click', () => submit('dismissed'));
      actions.append(skipButton);
    }
    status = element('p', 'company-profile__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    form.append(grid, notice, actions, status);
    form.addEventListener('submit', event => {
      event.preventDefault();
      submit('saved');
    });
    body.replaceChildren(form);
  }

  async function load() {
    if (!isCurrent()) return;
    const sequence = ++loadSequence;
    const loading = element('p', 'company-profile__status', 'Загружаем данные компании…');
    loading.setAttribute('role', 'status');
    status = loading;
    body.replaceChildren(loading);
    try {
      const view = await request();
      if (view && isCurrent() && sequence === loadSequence) renderForm(view);
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError' || sequence !== loadSequence) return;
      const message = element(
        'p',
        'company-profile__status company-profile__status--error',
        'Не удалось загрузить данные компании. Попробуйте ещё раз.',
      );
      message.setAttribute('role', 'status');
      status = message;
      const retry = element('button', 'company-profile__button', 'Повторить');
      retry.type = 'button';
      retry.addEventListener('click', load);
      body.replaceChildren(message, retry);
      offerDeferred();
    }
  }

  void load();
  return {
    dismiss() {
      if (mode === 'onboarding') return submit('dismissed');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
      inputs.clear();
      fieldErrors.clear();
      section.remove();
    },
  };
}
