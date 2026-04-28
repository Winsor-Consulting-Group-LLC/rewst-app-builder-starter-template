// ============================================
// PREREQUISITES PAGE (Company + User)
// ============================================

function renderPrerequisitesPage() {
  const container = document.getElementById('page-prerequisites');
  container.innerHTML = '';

  function createCardContainer(content, className) {
    const card = RewstDOM.createCard(content);
    card.className = className;
    return card;
  }

  // ---- Checklist items container ----
  const checklistContainer = document.createElement('div');
  checklistContainer.className = 'space-y-3';
  container.appendChild(checklistContainer);

  // ---- Company checks section ----
  const companySectionHeader = document.createElement('div');
  companySectionHeader.className = 'mt-6 mb-3';
  companySectionHeader.innerHTML = '<h3 class="text-lg font-semibold text-rewst-dark-gray">Company Prerequisites</h3>';
  checklistContainer.appendChild(companySectionHeader);

  const companyChecks = [
    { id: 'ca_name', label: 'CA Name' },
    { id: 'ad_domain', label: 'AD Domain' }
  ];

  const companyCheckElements = {};

  function createCheckCard(id, label) {
    const checkItem = createCardContainer(`
      <div class="text-rewst-gray">
        <span class="material-icons">schedule</span>
      </div>
      <div class="flex-1">
        <p class="text-rewst-dark-gray font-medium">${label}</p>
        <p class="text-sm text-rewst-gray">Pending - Waiting to start...</p>
      </div>
    `, 'card p-4 flex items-center gap-3');

    checkItem.id = id;
    return checkItem;
  }

  companyChecks.forEach(check => {
    const checkItem = createCheckCard(`check-${check.id}`, check.label);
    checklistContainer.appendChild(checkItem);
    companyCheckElements[check.id] = checkItem;
  });

  // ---- User checks section ----
  const userSectionHeader = document.createElement('div');
  userSectionHeader.className = 'mt-6 mb-3';
  userSectionHeader.innerHTML = '<h3 class="text-lg font-semibold text-rewst-dark-gray">User Prerequisites</h3>';
  checklistContainer.appendChild(userSectionHeader);

  const emailVerificationCheckItem = createCheckCard('check-email-verification', 'Email verification');
  checklistContainer.appendChild(emailVerificationCheckItem);

  const cwmCheckItem = createCheckCard('check-cwm-config', 'CWM Configuration');
  checklistContainer.appendChild(cwmCheckItem);

  const computerOnlineCheckItem = createCheckCard('check-computer-online', 'Computer Online');
  checklistContainer.appendChild(computerOnlineCheckItem);

  // ---- Computer checks section ----
  const computerSectionHeader = document.createElement('div');
  computerSectionHeader.className = 'mt-6 mb-3';
  computerSectionHeader.innerHTML = '<h3 class="text-lg font-semibold text-rewst-dark-gray">Computer Prerequisites</h3>';
  checklistContainer.appendChild(computerSectionHeader);

  const validMachineCertCheckItem = createCheckCard('check-valid-machine-cert', 'Valid machine certificate installed');
  checklistContainer.appendChild(validMachineCertCheckItem);

  const remoteDomainReachableCheckItem = createCheckCard('check-remote-domain-reachable', 'Remote domain reachable');
  checklistContainer.appendChild(remoteDomainReachableCheckItem);

  // ---- Continue button ----
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'mt-8 flex justify-center';

  const continueButton = document.createElement('button');
  continueButton.className = 'btn-primary flex items-center gap-2 opacity-50 cursor-not-allowed';
  continueButton.disabled = true;
  const defaultContinueButtonHtml = `
    <span class="material-icons">arrow_forward</span>
    <span>Continue to Manage VPN</span>
  `;
  continueButton.innerHTML = defaultContinueButtonHtml;
  continueButton.addEventListener('click', () => {
    if (autoProceedCountdownTimer) {
      stopAutoProceedCountdown();
      autoProceedTriggered = true;
      if (typeof window.maybeAutoNavigateToVpnSetup === 'function') {
        window.maybeAutoNavigateToVpnSetup();
        return;
      }
    }

    switchPage('vpnsetup');
  });

  buttonContainer.appendChild(continueButton);
  container.appendChild(buttonContainer);

  const checkStates = {
    ca_name: false,
    ad_domain: false,
    email_verification: false,
    cwm_config: false,
    computer_online: false,
    valid_machine_cert_installed: false,
    remote_domain_reachable: false
  };

  const MAX_CHECK_ATTEMPTS = 3; // Initial run + 2 retries
  const RETRY_DELAY_MS = 600;
  const EMAIL_LOOKUP_MAX_ATTEMPTS = 8;
  const EMAIL_LOOKUP_RETRY_DELAY_MS = 1500;
  const EMAIL_LOOKUP_MAX_WAIT_MS = 2 * 60 * 1000;
  const COMPUTER_CHECK_MAX_WAIT_MS = 5 * 60 * 1000;
  const COMPUTER_CHECK_RETRY_DELAY_MS = 5000;
  const COMPUTER_CHECK_MAX_ATTEMPTS = 60;
  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';

  const configuredCountdown = Number(window.APP_CONFIG?.autoProceedCountdownSeconds);
  const AUTO_PROCEED_COUNTDOWN_SECONDS = Number.isInteger(configuredCountdown) && configuredCountdown > 0
    ? configuredCountdown
    : 3;

  let currentUserEmail = null;
  let emailLookupInFlight = null;
  let selectedConfig = null;
  let autoProceedCountdownTimer = null;
  let autoProceedCountdownValue = AUTO_PROCEED_COUNTDOWN_SECONDS;
  let autoProceedTriggered = false;
  const checkResultDetails = {
    ca_name: '',
    ad_domain: '',
    email_verification: '',
    cwm_config: '',
    computer_online: '',
    valid_machine_cert_installed: '',
    remote_domain_reachable: ''
  };

  const workflowIds = window.WORKFLOW_IDS || {};
  const REQUIRED_PASSING_KEYS = [
    'ca_name',
    'ad_domain',
    'email_verification',
    'cwm_config',
    'computer_online',
    'valid_machine_cert_installed'
  ];

  function getWorkflowId(key) {
    const id = workflowIds[key];
    if (!id) {
      throw new Error(`Missing workflow ID for ${key}. Set it in src/workflow-ids.local.js`);
    }
    return id;
  }

  function getCachedPrereqs() {
    try {
      const raw = sessionStorage.getItem(PREREQS_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearCachedPrereqs() {
    try {
      sessionStorage.removeItem(PREREQS_CACHE_KEY);
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function persistPrereqsIfPassed() {
    const allPassed = Object.values(checkStates).every(state => state === true);
    if (!allPassed) return;

    try {
      sessionStorage.setItem(PREREQS_CACHE_KEY, JSON.stringify({
        checkStates,
        checkResultDetails,
        selectedConfig,
        currentUserEmail
      }));
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function applyCachedPrereqs(cache) {
    const states = cache?.checkStates;
    const details = cache?.checkResultDetails;
    if (!states || !details) return false;

    const requiredKeys = [
      ...REQUIRED_PASSING_KEYS,
      'remote_domain_reachable'
    ];
    const allPassed = requiredKeys.every(key => states[key] === true);
    const unlockPassed = REQUIRED_PASSING_KEYS.every(key => states[key] === true);
    if (!(allPassed || unlockPassed)) return false;

    requiredKeys.forEach(key => {
      checkStates[key] = true;
      checkResultDetails[key] = details[key] || '';
    });

    if (cache.currentUserEmail) {
      currentUserEmail = cache.currentUserEmail;
    }

    if (cache.selectedConfig) {
      selectedConfig = cache.selectedConfig;
      window.selectedConfig = selectedConfig;
      try {
        sessionStorage.setItem('selectedConfig', JSON.stringify(selectedConfig));
      } catch (e) {
        // Ignore storage errors.
      }
    }

    renderCheckResult(companyCheckElements['ca_name'], true, 'CA Name', checkResultDetails.ca_name);
    renderCheckResult(companyCheckElements['ad_domain'], true, 'AD Domain', checkResultDetails.ad_domain);
    renderCheckResult(emailVerificationCheckItem, true, 'Email verification', checkResultDetails.email_verification);
    renderCheckResult(cwmCheckItem, true, 'CWM Configuration', checkResultDetails.cwm_config);
    renderCheckResult(computerOnlineCheckItem, true, 'Computer Online', checkResultDetails.computer_online);
    renderCheckResult(
      validMachineCertCheckItem,
      true,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed
    );
    renderCheckResult(
      remoteDomainReachableCheckItem,
      checkStates.remote_domain_reachable,
      'Remote domain reachable',
      checkResultDetails.remote_domain_reachable,
      null,
      checkStates.remote_domain_reachable ? {} : { statusType: 'info', statusText: 'Informational' }
    );
    updateButtonState();
    return true;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  function setCheckLoading(element, label, details = 'Validating...', statusText = 'Running') {
    renderCheckResult(element, false, label, details, null, {
      statusType: 'running',
      statusText
    });
  }

  function setCheckPending(element, label, details = 'Waiting on previous checks...') {
    renderCheckResult(element, false, label, details, null, {
      statusType: 'pending',
      statusText: 'Pending'
    });
  }

  function renderCheckResult(element, passed, label, details = '', onRetry = null, options = {}) {
    const statusType = options.statusType || (passed ? 'passed' : 'failed');
    const statusIcon = statusType === 'passed'
      ? 'check_circle'
      : statusType === 'info'
        ? 'info'
        : statusType === 'pending'
          ? 'schedule'
          : statusType === 'running'
            ? 'sync'
            : 'cancel';
    const statusClass = statusType === 'passed'
      ? 'text-green-500'
      : statusType === 'info'
        ? 'text-yellow-500'
        : statusType === 'pending'
          ? 'text-rewst-gray'
          : statusType === 'running'
            ? 'text-rewst-teal'
            : 'text-red-500';
    const statusText = options.statusText || (statusType === 'passed'
      ? 'Passed'
      : statusType === 'info'
        ? 'Informational'
        : statusType === 'pending'
          ? 'Pending'
          : statusType === 'running'
            ? 'Running'
            : 'Failed');
    const iconAnimationClass = statusType === 'running' ? 'animate-spin' : '';
    const showRetry = !passed && typeof onRetry === 'function';

    element.innerHTML = `
      <div class="${statusClass}">
        <span class="material-icons ${iconAnimationClass}">${statusIcon}</span>
      </div>
      <div class="flex-1">
        <p class="text-rewst-dark-gray font-medium">${label}</p>
        <p class="text-sm text-rewst-gray">${statusText}${details ? ` - ${details}` : ''}</p>
      </div>
      ${showRetry ? '<button class="btn-secondary btn-sm retry-btn flex items-center gap-1"><span class="material-icons text-sm">refresh</span><span>Re-check</span></button>' : ''}
    `;

    if (showRetry) {
      const retryBtn = element.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', onRetry);
      }
    }
  }

  function hasAutoNavigatedToVpnAlready() {
    try {
      return sessionStorage.getItem('autoNavigatedToVpnSetupV1') === 'true';
    } catch (e) {
      return false;
    }
  }

  function stopAutoProceedCountdown(resetState = false) {
    if (autoProceedCountdownTimer) {
      clearInterval(autoProceedCountdownTimer);
      autoProceedCountdownTimer = null;
    }

    if (resetState) {
      autoProceedCountdownValue = AUTO_PROCEED_COUNTDOWN_SECONDS;
      autoProceedTriggered = false;
    }
  }

  function updateContinueButtonForCountdown() {
    continueButton.innerHTML = `
      <span class="material-icons">check_circle</span>
      <span>All checks passed. Proceeding in ${autoProceedCountdownValue}... (Proceed now)</span>
    `;
  }

  function startAutoProceedCountdown() {
    if (autoProceedTriggered || autoProceedCountdownTimer || hasAutoNavigatedToVpnAlready()) {
      return;
    }

    autoProceedCountdownValue = AUTO_PROCEED_COUNTDOWN_SECONDS;
    continueButton.disabled = false;
    continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
    continueButton.classList.add('cursor-pointer');
    updateContinueButtonForCountdown();

    autoProceedCountdownTimer = setInterval(() => {
      autoProceedCountdownValue -= 1;

      if (autoProceedCountdownValue > 0) {
        updateContinueButtonForCountdown();
        return;
      }

      stopAutoProceedCountdown();
      autoProceedTriggered = true;
      continueButton.innerHTML = `
        <span class="material-icons">arrow_forward</span>
        <span>Opening Manage VPN...</span>
      `;

      if (typeof window.maybeAutoNavigateToVpnSetup === 'function') {
        window.maybeAutoNavigateToVpnSetup();
      }
    }, 1000);
  }

  function updateButtonState() {
    const allPassed = REQUIRED_PASSING_KEYS.every(key => checkStates[key] === true);

    if (!allPassed) {
      stopAutoProceedCountdown(true);
      continueButton.innerHTML = defaultContinueButtonHtml;
    }

    continueButton.disabled = !allPassed;
    if (allPassed) {
      continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
      continueButton.classList.add('cursor-pointer');
    } else {
      continueButton.classList.add('opacity-50', 'cursor-not-allowed');
      continueButton.classList.remove('cursor-pointer');
    }

    if (allPassed) {
      persistPrereqsIfPassed();
    }

    if (typeof window.setVpnSetupNavEnabled === 'function') {
      window.setVpnSetupNavEnabled(allPassed);
    }

    if (allPassed) {
      if (hasAutoNavigatedToVpnAlready()) {
        continueButton.innerHTML = defaultContinueButtonHtml;
      } else {
        startAutoProceedCountdown();
      }
    }
  }

  async function runWithRetries(task, isSuccess, operationName = 'workflow', options = {}) {
    const maxAttempts = options.maxAttempts || MAX_CHECK_ATTEMPTS;
    const retryDelayMs = options.retryDelayMs || RETRY_DELAY_MS;
    const maxTotalMs = options.maxTotalMs || null;
    const onAttemptStart = typeof options.onAttemptStart === 'function' ? options.onAttemptStart : null;
    const onRetryWait = typeof options.onRetryWait === 'function' ? options.onRetryWait : null;

    let lastResult = null;
    let lastError = null;
    let attemptsMade = 0;
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsMade = attempt;
      const elapsedAtAttemptStart = Date.now() - startedAt;
      if (onAttemptStart) {
        onAttemptStart({
          attempt,
          maxAttempts,
          elapsedMs: elapsedAtAttemptStart,
          maxTotalMs
        });
      }

      try {
        debugLog(`[Retry] ${operationName}: attempt ${attempt}/${maxAttempts}`);
        const result = await task();
        lastResult = result;

        if (isSuccess(result)) {
          debugLog(`[Retry] ${operationName}: success on attempt ${attempt}/${maxAttempts}`);
          return { ok: true, result, attempts: attempt, error: null };
        }

        debugWarn(`[Retry] ${operationName}: attempt ${attempt}/${maxAttempts} did not meet success criteria`);
      } catch (error) {
        lastError = error;
        debugWarn(`[Retry] ${operationName}: attempt ${attempt}/${maxAttempts} threw error`, error);
      }

      const elapsedAfterAttempt = Date.now() - startedAt;
      const timeBudgetAllowsRetry = !maxTotalMs || (elapsedAfterAttempt + retryDelayMs) <= maxTotalMs;

      if (attempt < maxAttempts && timeBudgetAllowsRetry) {
        if (onRetryWait) {
          onRetryWait({
            attempt,
            maxAttempts,
            delayMs: retryDelayMs,
            elapsedMs: elapsedAfterAttempt,
            maxTotalMs
          });
        }
        debugLog(`[Retry] ${operationName}: waiting ${retryDelayMs}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else if (attempt < maxAttempts && !timeBudgetAllowsRetry) {
        debugWarn(`[Retry] ${operationName}: stopping retries because ${maxTotalMs}ms max wait budget was reached`);
        break;
      }
    }

    const elapsedMs = Date.now() - startedAt;
    return {
      ok: false,
      result: lastResult,
      attempts: attemptsMade,
      error: lastError,
      elapsedMs,
      exhaustedTimeBudget: !!maxTotalMs && elapsedMs >= maxTotalMs
    };
  }

  function buildResultDataCandidates(result) {
    const candidates = [];
    const pushIfObject = (value) => {
      if (value && typeof value === 'object') {
        candidates.push(value);
      }
    };

    pushIfObject(result);
    pushIfObject(result?.output);
    pushIfObject(result?.execution?.conductor?.output);
    pushIfObject(result?.execution?.output);

    const base = candidates.slice();
    base.forEach((candidate) => {
      pushIfObject(candidate.output);
      pushIfObject(candidate.result);
      pushIfObject(candidate.data);
      pushIfObject(candidate.payload);
    });

    return candidates;
  }

  function getFirstFieldValue(result, fieldNames) {
    const candidates = buildResultDataCandidates(result);
    for (const candidate of candidates) {
      for (const fieldName of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(candidate, fieldName)) {
          const value = candidate[fieldName];
          if (value !== undefined && value !== null) {
            return value;
          }
        }
      }
    }
    return null;
  }

  function parseBooleanLike(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'y', '1', 'online', 'connected', 'up'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0', 'offline', 'disconnected', 'down'].includes(normalized)) return false;
    }
    return null;
  }

  function getBooleanFieldValue(result, fieldNames) {
    const rawValue = getFirstFieldValue(result, fieldNames);
    return {
      rawValue,
      parsed: parseBooleanLike(rawValue)
    };
  }

  async function ensureUserEmail() {
    if (currentUserEmail) return currentUserEmail;

    if (!emailLookupInFlight) {
      emailLookupInFlight = (async () => {
        const extractUserEmail = (result) => {
            const candidates = [
              getFirstFieldValue(result, ['username']),
              getFirstFieldValue(result, ['user_email', 'userEmail']),
              getFirstFieldValue(result, ['email']),
              getFirstFieldValue(result, ['user_principal_name', 'userPrincipalName'])
            ];

            for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
              return candidate.trim();
            }
          }

          return null;
        };

        const attemptResult = await runWithRetries(
          () => rewst.runWorkflowSmart(getWorkflowId('USER_EMAIL')),
          (lookupResult) => !!extractUserEmail(lookupResult),
          'Email verification lookup',
          {
            maxAttempts: EMAIL_LOOKUP_MAX_ATTEMPTS,
            retryDelayMs: EMAIL_LOOKUP_RETRY_DELAY_MS,
            maxTotalMs: EMAIL_LOOKUP_MAX_WAIT_MS
          }
        );

        const email = extractUserEmail(attemptResult.result);
        if (!attemptResult.ok || !email) {
          let message = `Could not determine current user email after ${attemptResult.attempts} attempts over ${formatDuration(attemptResult.elapsedMs || 0)}`;
          if (attemptResult.exhaustedTimeBudget) {
            message += ` (reached ${formatDuration(EMAIL_LOOKUP_MAX_WAIT_MS)} wait limit)`;
          }
          throw new Error(message);
        }

        currentUserEmail = email;
        return currentUserEmail;
      })().finally(() => {
        emailLookupInFlight = null;
      });
    }

    return emailLookupInFlight;
  }

  function startUserEmailPrefetch() {
    if (currentUserEmail || emailLookupInFlight) {
      return;
    }

    ensureUserEmail().catch((error) => {
      debugWarn('Background email prefetch did not resolve yet:', error);
    });
  }

  async function runEmailVerificationCheck(options = {}) {
    const continuePipeline = options.continuePipeline === true;

    setCheckLoading(emailVerificationCheckItem, 'Email verification', 'Looking up your current account details...');
    checkResultDetails.email_verification = '';

    try {
      const email = await ensureUserEmail();
      checkStates.email_verification = true;
      checkResultDetails.email_verification = email;
      renderCheckResult(emailVerificationCheckItem, true, 'Email verification', email);
    } catch (error) {
      checkStates.email_verification = false;
      checkResultDetails.email_verification = error.message || 'Workflow execution failed';
      currentUserEmail = null;
      clearCachedPrereqs();
      renderCheckResult(
        emailVerificationCheckItem,
        false,
        'Email verification',
        checkResultDetails.email_verification,
        () => runEmailVerificationCheck({ continuePipeline: true })
      );
    } finally {
      updateButtonState();
    }

    if (continuePipeline && checkStates.email_verification) {
      await runCwmConfigurationCheck();
      await runComputerOnlineCheck();
    }
  }

  async function runCaNameCheck() {
    const element = companyCheckElements['ca_name'];
    setCheckLoading(element, 'CA Name', 'Fetching company configuration data...');
    checkResultDetails.ca_name = '';

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPANY_PREREQUISITES')),
        (result) => {
          const value = getFirstFieldValue(result, ['ca_name', 'caName']);
          return !!value;
        },
        'Company prerequisite: CA Name'
      );

      if (attemptResult.ok) {
        const value = getFirstFieldValue(attemptResult.result, ['ca_name', 'caName']);
        checkStates.ca_name = true;
        checkResultDetails.ca_name = `Data: ${value}`;
        renderCheckResult(element, true, 'CA Name', checkResultDetails.ca_name);
      } else {
        checkStates.ca_name = false;
        checkResultDetails.ca_name = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No CA Name returned after ${attemptResult.attempts} attempts`;
        clearCachedPrereqs();
        renderCheckResult(element, false, 'CA Name', checkResultDetails.ca_name, runCaNameCheck);
      }
    } finally {
      updateButtonState();
    }
  }

  async function runAdDomainCheck() {
    const element = companyCheckElements['ad_domain'];
    setCheckLoading(element, 'AD Domain', 'Fetching company configuration data...');
    checkResultDetails.ad_domain = '';

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPANY_PREREQUISITES')),
        (result) => {
          const value = getFirstFieldValue(result, ['ad_domain', 'adDomain']);
          return !!value;
        },
        'Company prerequisite: AD Domain'
      );

      if (attemptResult.ok) {
        const value = getFirstFieldValue(attemptResult.result, ['ad_domain', 'adDomain']);
        checkStates.ad_domain = true;
        checkResultDetails.ad_domain = `Data: ${value}`;
        renderCheckResult(element, true, 'AD Domain', checkResultDetails.ad_domain);
      } else {
        checkStates.ad_domain = false;
        checkResultDetails.ad_domain = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No AD Domain returned after ${attemptResult.attempts} attempts`;
        clearCachedPrereqs();
        renderCheckResult(element, false, 'AD Domain', checkResultDetails.ad_domain, runAdDomainCheck);
      }
    } finally {
      updateButtonState();
    }
  }

  async function runCwmConfigurationCheck() {
    setCheckLoading(cwmCheckItem, 'CWM Configuration', 'Communicating with CWM to discover valid configurations...');
    checkResultDetails.cwm_config = '';
    selectedConfig = null;
    window.selectedConfig = null;
    clearCachedPrereqs();
    try {
      sessionStorage.removeItem('selectedConfig');
    } catch (e) {
      // Ignore storage errors.
    }

    try {
      if (!checkStates.email_verification) {
        checkStates.cwm_config = false;
        checkResultDetails.cwm_config = 'Run Email verification first';
        renderCheckResult(
          cwmCheckItem,
          false,
          'CWM Configuration',
          'Waiting for Email verification to pass.',
          () => runEmailVerificationCheck({ continuePipeline: true }),
          { statusType: 'pending', statusText: 'Pending' }
        );
        return;
      }

      const userEmail = await ensureUserEmail();
      const getValidConfigs = (result) => {
        const configs = getFirstFieldValue(result, ['cwm_configurations', 'cwmConfigurations', 'configurations']) || [];
        return configs.filter(config =>
          config && typeof config === 'object' && config.name && config.id && config.deviceIdentifier
        );
      };

      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('CWM_CONFIGURATIONS'), {
          user_principal_name: userEmail
        }),
        (result) => getValidConfigs(result).length > 0,
        'User prerequisite: CWM Configuration'
      );

      const validConfigs = getValidConfigs(attemptResult.result);

      if (!attemptResult.ok || validConfigs.length === 0) {
        checkStates.cwm_config = false;
        checkResultDetails.cwm_config = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No valid configurations found after ${attemptResult.attempts} attempts`;
        renderCheckResult(cwmCheckItem, false, 'CWM Configuration', checkResultDetails.cwm_config, runCwmConfigurationCheck);
      } else if (validConfigs.length === 1) {
        selectedConfig = validConfigs[0];
        window.selectedConfig = selectedConfig;
        try {
          sessionStorage.setItem('selectedConfig', JSON.stringify(selectedConfig));
        } catch (e) {
          // Ignore storage errors.
        }
        checkStates.cwm_config = true;
        checkResultDetails.cwm_config = `Selected: ${selectedConfig.name}`;
        renderCheckResult(cwmCheckItem, true, 'CWM Configuration', checkResultDetails.cwm_config);
      } else {
        selectedConfig = validConfigs[0];
        window.selectedConfig = selectedConfig;
        try {
          sessionStorage.setItem('selectedConfig', JSON.stringify(selectedConfig));
        } catch (e) {
          // Ignore storage errors.
        }
        checkStates.cwm_config = true;
        checkResultDetails.cwm_config = `Multiple found, selected: ${selectedConfig.name}`;
        renderCheckResult(cwmCheckItem, true, 'CWM Configuration', checkResultDetails.cwm_config);
      }
    } catch (error) {
      checkStates.cwm_config = false;
      checkResultDetails.cwm_config = error.message || 'Workflow execution failed';
      currentUserEmail = null;
      window.selectedConfig = null;
      try {
        sessionStorage.removeItem('selectedConfig');
      } catch (e) {
        // Ignore storage errors.
      }
      clearCachedPrereqs();
      renderCheckResult(cwmCheckItem, false, 'CWM Configuration', checkResultDetails.cwm_config, runCwmConfigurationCheck);
    } finally {
      updateButtonState();
    }
  }

  async function runComputerOnlineCheck() {
    setCheckLoading(
      computerOnlineCheckItem,
      'Computer Online',
      'Initial request sent. This can take up to 5 minutes.',
      'Communicating with your PC'
    );
    checkResultDetails.computer_online = '';

    try {
      if (!selectedConfig || !selectedConfig.deviceIdentifier) {
        checkStates.computer_online = false;
        checkResultDetails.computer_online = 'No valid CWM configuration selected';
        renderCheckResult(
          computerOnlineCheckItem,
          false,
          'Computer Online',
          checkResultDetails.computer_online,
          runComputerOnlineCheck
        );
        clearCachedPrereqs();
        return;
      }

      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_ONLINE'), {
          cwa_computer_id: selectedConfig.deviceIdentifier
        }),
        (result) => getBooleanFieldValue(result, ['online', 'is_online', 'computer_online', 'isOnline']).parsed === true,
        'User prerequisite: Computer Online',
        {
          maxAttempts: COMPUTER_CHECK_MAX_ATTEMPTS,
          retryDelayMs: COMPUTER_CHECK_RETRY_DELAY_MS,
          maxTotalMs: COMPUTER_CHECK_MAX_WAIT_MS,
          onAttemptStart: ({ attempt, maxAttempts }) => {
            setCheckLoading(
              computerOnlineCheckItem,
              'Computer Online',
              `Attempt ${attempt}/${maxAttempts}. This can take up to 5 minutes.`,
              'Communicating with your PC'
            );
          }
        }
      );

      if (attemptResult.ok) {
        const onlineValue = getBooleanFieldValue(
          attemptResult.result,
          ['online', 'is_online', 'computer_online', 'isOnline']
        ).rawValue;
        checkStates.computer_online = true;
        checkResultDetails.computer_online = `Status: ${onlineValue}`;
        renderCheckResult(
          computerOnlineCheckItem,
          true,
          'Computer Online',
          checkResultDetails.computer_online,
          runComputerOnlineCheck
        );
      } else {
        checkStates.computer_online = false;
        checkResultDetails.computer_online = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `Computer not online after ${attemptResult.attempts} attempts over ${formatDuration(attemptResult.elapsedMs || 0)}`;

        if (attemptResult.exhaustedTimeBudget) {
          checkResultDetails.computer_online += ' (reached 5 minute wait limit)';
        }
        clearCachedPrereqs();
        renderCheckResult(computerOnlineCheckItem, false, 'Computer Online', checkResultDetails.computer_online, runComputerOnlineCheck);
      }
    } catch (error) {
      checkStates.computer_online = false;
      checkResultDetails.computer_online = error.message || 'Workflow execution failed';
      clearCachedPrereqs();
      renderCheckResult(computerOnlineCheckItem, false, 'Computer Online', checkResultDetails.computer_online, runComputerOnlineCheck);
    } finally {
      if (checkStates.computer_online) {
        await runComputerPrerequisitesChecks();
      } else {
        clearComputerPrereqStateAndRenderBlocked();
      }
      updateButtonState();
    }
  }

  function parsePositiveInteger(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 ? value : null;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
  }

  function evaluateComputerPrereqs(result) {
    const directInfo = getFirstFieldValue(result, ['prereq_info', 'prereqInfo']);
    const data = directInfo && typeof directInfo === 'object'
      ? directInfo
      : (buildResultDataCandidates(result).find(candidate =>
          Object.prototype.hasOwnProperty.call(candidate, 'ValidCertCount') ||
          Object.prototype.hasOwnProperty.call(candidate, 'DomainTest')
        ) || {});

    const validCertCountRaw = data?.ValidCertCount;
    const validCertCount = Number(validCertCountRaw);
    const certPassed = Number.isFinite(validCertCount) && validCertCount >= 1;

    const responseTimeRaw = data?.DomainTest?.ResponseTime;
    const responseTime = parsePositiveInteger(responseTimeRaw);
    const responseTimePassed = responseTime !== null && responseTime < 10000;

    return {
      certPassed,
      responseTimePassed,
      validCertCountRaw,
      responseTimeRaw,
      responseTime
    };
  }

  function clearComputerPrereqStateAndRenderBlocked() {
    checkStates.valid_machine_cert_installed = false;
    checkStates.remote_domain_reachable = false;
    checkResultDetails.valid_machine_cert_installed = 'Waiting for Computer Online to pass';
    checkResultDetails.remote_domain_reachable = 'Waiting for Computer Online to pass';

    setCheckPending(
      validMachineCertCheckItem,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed
    );
    setCheckPending(
      remoteDomainReachableCheckItem,
      'Remote domain reachable',
      checkResultDetails.remote_domain_reachable
    );
    clearCachedPrereqs();
  }

  function renderComputerPrereqResults(evaluation, attemptInfo = null) {
    checkStates.valid_machine_cert_installed = evaluation.certPassed;
    checkStates.remote_domain_reachable = evaluation.responseTimePassed;

    const certDetails = evaluation.certPassed
      ? `ValidCertCount: ${evaluation.validCertCountRaw}`
      : `ValidCertCount must be 1 or higher (received: ${evaluation.validCertCountRaw ?? 'none'})`;

    const domainDetails = evaluation.responseTimePassed
      ? `ResponseTime: ${evaluation.responseTime}ms`
      : `Domain not reachable right now (ResponseTime: ${evaluation.responseTimeRaw ?? 'none'}). This is informational and does not block VPN setup.`;

    const failureSuffix = attemptInfo ? ` after ${attemptInfo.attempts} attempts` : '';

    checkResultDetails.valid_machine_cert_installed = evaluation.certPassed
      ? certDetails
      : certDetails + failureSuffix;
    checkResultDetails.remote_domain_reachable = evaluation.responseTimePassed
      ? domainDetails
      : domainDetails + failureSuffix;

    renderCheckResult(
      validMachineCertCheckItem,
      evaluation.certPassed,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed,
      runComputerPrerequisitesChecks
    );
    renderCheckResult(
      remoteDomainReachableCheckItem,
      evaluation.responseTimePassed,
      'Remote domain reachable',
      checkResultDetails.remote_domain_reachable,
      runComputerPrerequisitesChecks,
      evaluation.responseTimePassed ? {} : { statusType: 'info', statusText: 'Informational' }
    );
  }

  async function runComputerPrerequisitesChecks() {
    if (!checkStates.computer_online) {
      clearComputerPrereqStateAndRenderBlocked();
      updateButtonState();
      return;
    }

    setCheckLoading(
      validMachineCertCheckItem,
      'Valid machine certificate installed',
      'Initial request sent. This can take up to 5 minutes.',
      'Communicating with your PC'
    );
    setCheckLoading(
      remoteDomainReachableCheckItem,
      'Remote domain reachable',
      'Initial request sent. This can take up to 5 minutes.',
      'Communicating with your PC'
    );
    checkResultDetails.valid_machine_cert_installed = '';
    checkResultDetails.remote_domain_reachable = '';

    if (!selectedConfig || !selectedConfig.deviceIdentifier) {
      checkStates.valid_machine_cert_installed = false;
      checkStates.remote_domain_reachable = false;
      checkResultDetails.valid_machine_cert_installed = 'Missing CWA ID from selected configuration';
      checkResultDetails.remote_domain_reachable = 'Missing CWA ID from selected configuration';

      setCheckPending(
        validMachineCertCheckItem,
        'Valid machine certificate installed',
        checkResultDetails.valid_machine_cert_installed
      );
      setCheckPending(
        remoteDomainReachableCheckItem,
        'Remote domain reachable',
        checkResultDetails.remote_domain_reachable
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const attemptResult = await runWithRetries(
      () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_PREREQUISITES'), { in_cwa_id: selectedConfig.deviceIdentifier }),
      (result) => {
        const evaluation = evaluateComputerPrereqs(result);
        return evaluation.certPassed;
      },
      'Computer prerequisite checks',
      {
        maxAttempts: COMPUTER_CHECK_MAX_ATTEMPTS,
        retryDelayMs: COMPUTER_CHECK_RETRY_DELAY_MS,
        maxTotalMs: COMPUTER_CHECK_MAX_WAIT_MS,
        onAttemptStart: ({ attempt, maxAttempts }) => {
          const detail = `Attempt ${attempt}/${maxAttempts}. This can take up to 5 minutes.`;
          setCheckLoading(validMachineCertCheckItem, 'Valid machine certificate installed', detail, 'Communicating with your PC');
          setCheckLoading(remoteDomainReachableCheckItem, 'Remote domain reachable', detail, 'Communicating with your PC');
        }
      }
    );

    if (attemptResult.ok) {
      const evaluation = evaluateComputerPrereqs(attemptResult.result);
      renderComputerPrereqResults(evaluation);
      updateButtonState();
      return;
    }

    if (attemptResult.error && !attemptResult.result) {
      let errorDetails = `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts over ${formatDuration(attemptResult.elapsedMs || 0)})`;
      if (attemptResult.exhaustedTimeBudget) {
        errorDetails += ' (reached 5 minute wait limit)';
      }
      checkStates.valid_machine_cert_installed = false;
      checkStates.remote_domain_reachable = false;
      checkResultDetails.valid_machine_cert_installed = errorDetails;
      checkResultDetails.remote_domain_reachable = errorDetails;

      renderCheckResult(
        validMachineCertCheckItem,
        false,
        'Valid machine certificate installed',
        errorDetails,
        runComputerPrerequisitesChecks
      );
      renderCheckResult(
        remoteDomainReachableCheckItem,
        false,
        'Remote domain reachable',
        errorDetails,
        runComputerPrerequisitesChecks
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const evaluation = evaluateComputerPrereqs(attemptResult.result);
    renderComputerPrereqResults(evaluation, attemptResult);
    clearCachedPrereqs();
    updateButtonState();
  }

  // ---- Run workflow and check results ----
  (async () => {
    debugLog('Starting prerequisites checks...');

    setCheckPending(companyCheckElements['ca_name'], 'CA Name', 'Queued to start.');
    setCheckPending(companyCheckElements['ad_domain'], 'AD Domain', 'Waiting for CA Name to complete.');
    setCheckPending(emailVerificationCheckItem, 'Email verification', 'Waiting for company checks to complete.');
    setCheckPending(cwmCheckItem, 'CWM Configuration', 'Waiting for Email verification to pass.');
    setCheckPending(computerOnlineCheckItem, 'Computer Online', 'Waiting for CWM Configuration to complete.');
    setCheckPending(validMachineCertCheckItem, 'Valid machine certificate installed', 'Waiting for Computer Online to pass.');
    setCheckPending(remoteDomainReachableCheckItem, 'Remote domain reachable', 'Waiting for Computer Online to pass.');

    // Start user email lookup immediately so it is ready when the check is reached.
    startUserEmailPrefetch();

    const cached = getCachedPrereqs();
    if (applyCachedPrereqs(cached)) {
      debugLog('Loaded prerequisites checks from session cache');
      return;
    }

    // Company checks first
    await runCaNameCheck();
    await runAdDomainCheck();

    // User checks second
    await runEmailVerificationCheck();
    await runCwmConfigurationCheck();
    await runComputerOnlineCheck();
  })();
}
