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
        <div class="animate-spin">
          <span class="material-icons">hourglass_empty</span>
        </div>
      </div>
      <div class="flex-1">
        <p class="text-rewst-dark-gray font-medium">${label}</p>
        <p class="text-sm text-rewst-gray">Validating...</p>
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
  continueButton.innerHTML = `
    <span class="material-icons">arrow_forward</span>
    <span>Continue to VPN Setup</span>
  `;
  continueButton.addEventListener('click', () => {
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
  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';

  let currentUserEmail = null;
  let selectedConfig = null;
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
      'ca_name',
      'ad_domain',
      'email_verification',
      'cwm_config',
      'computer_online',
      'valid_machine_cert_installed',
      'remote_domain_reachable'
    ];
    const allPassed = requiredKeys.every(key => states[key] === true);
    if (!allPassed) return false;

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
      true,
      'Remote domain reachable',
      checkResultDetails.remote_domain_reachable
    );
    updateButtonState();
    return true;
  }

  function setCheckLoading(element, label) {
    element.innerHTML = `
      <div class="text-rewst-gray">
        <div class="animate-spin">
          <span class="material-icons">hourglass_empty</span>
        </div>
      </div>
      <div class="flex-1">
        <p class="text-rewst-dark-gray font-medium">${label}</p>
        <p class="text-sm text-rewst-gray">Validating...</p>
      </div>
    `;
  }

  function renderCheckResult(element, passed, label, details = '', onRetry = null) {
    const statusIcon = passed ? 'check_circle' : 'cancel';
    const statusClass = passed ? 'text-green-500' : 'text-red-500';
    const statusText = passed ? 'Passed' : 'Failed';
    const showRetry = !passed && typeof onRetry === 'function';

    element.innerHTML = `
      <div class="${statusClass}">
        <span class="material-icons">${statusIcon}</span>
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

  function updateButtonState() {
    const allPassed = Object.values(checkStates).every(state => state === true);
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
  }

  async function runWithRetries(task, isSuccess) {
    let lastResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_CHECK_ATTEMPTS; attempt++) {
      try {
        const result = await task();
        lastResult = result;

        if (isSuccess(result)) {
          return { ok: true, result, attempts: attempt, error: null };
        }
      } catch (error) {
        lastError = error;
      }
    }

    return { ok: false, result: lastResult, attempts: MAX_CHECK_ATTEMPTS, error: lastError };
  }

  async function ensureUserEmail() {
    if (currentUserEmail) return currentUserEmail;

    const attemptResult = await runWithRetries(
      () => rewst.runWorkflowSmart(getWorkflowId('USER_EMAIL')),
      (usernameResult) => !!usernameResult?.output?.username
    );

    const email = attemptResult.result?.output?.username;
    if (!attemptResult.ok || !email) {
      throw new Error(`Could not determine current user email after ${attemptResult.attempts} attempts`);
    }

    currentUserEmail = email;
    return currentUserEmail;
  }

  async function runEmailVerificationCheck() {
    setCheckLoading(emailVerificationCheckItem, 'Email verification');
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
        runEmailVerificationCheck
      );
    } finally {
      updateButtonState();
    }
  }

  async function runCaNameCheck() {
    const element = companyCheckElements['ca_name'];
    setCheckLoading(element, 'CA Name');
    checkResultDetails.ca_name = '';

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPANY_PREREQUISITES')),
        (result) => {
          const data = result?.output || result;
          return !!data?.ca_name;
        }
      );

      if (attemptResult.ok) {
        const data = attemptResult.result?.output || attemptResult.result;
        const value = data?.ca_name;
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
    setCheckLoading(element, 'AD Domain');
    checkResultDetails.ad_domain = '';

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPANY_PREREQUISITES')),
        (result) => {
          const data = result?.output || result;
          return !!data?.ad_domain;
        }
      );

      if (attemptResult.ok) {
        const data = attemptResult.result?.output || attemptResult.result;
        const value = data?.ad_domain;
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
    setCheckLoading(cwmCheckItem, 'CWM Configuration');
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
          checkResultDetails.cwm_config,
          runCwmConfigurationCheck
        );
        return;
      }

      const userEmail = await ensureUserEmail();
      const getValidConfigs = (result) => {
        const data = result?.output || result;
        const configs = data?.cwm_configurations || [];
        return configs.filter(config =>
          config && typeof config === 'object' && config.name && config.id && config.deviceIdentifier
        );
      };

      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart(getWorkflowId('CWM_CONFIGURATIONS'), {
          user_principal_name: userEmail
        }),
        (result) => getValidConfigs(result).length > 0
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
    setCheckLoading(computerOnlineCheckItem, 'Computer Online');
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
        (result) => !!result?.output?.online
      );

      if (attemptResult.ok) {
        const onlineValue = attemptResult.result?.output?.online;
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
          : `Computer not online after ${attemptResult.attempts} attempts`;
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
    const data = result?.output?.prereq_info || result || {};

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

    renderCheckResult(
      validMachineCertCheckItem,
      false,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed,
      runComputerPrerequisitesChecks
    );
    renderCheckResult(
      remoteDomainReachableCheckItem,
      false,
      'Remote domain reachable',
      checkResultDetails.remote_domain_reachable,
      runComputerPrerequisitesChecks
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
      : `ResponseTime must be a positive integer under 10000 (received: ${evaluation.responseTimeRaw ?? 'none'})`;

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
      runComputerPrerequisitesChecks
    );
  }

  async function runComputerPrerequisitesChecks() {
    if (!checkStates.computer_online) {
      clearComputerPrereqStateAndRenderBlocked();
      updateButtonState();
      return;
    }

    setCheckLoading(validMachineCertCheckItem, 'Valid machine certificate installed');
    setCheckLoading(remoteDomainReachableCheckItem, 'Remote domain reachable');
    checkResultDetails.valid_machine_cert_installed = '';
    checkResultDetails.remote_domain_reachable = '';

    if (!selectedConfig || !selectedConfig.deviceIdentifier) {
      checkStates.valid_machine_cert_installed = false;
      checkStates.remote_domain_reachable = false;
      checkResultDetails.valid_machine_cert_installed = 'Missing CWA ID from selected configuration';
      checkResultDetails.remote_domain_reachable = 'Missing CWA ID from selected configuration';

      renderCheckResult(
        validMachineCertCheckItem,
        false,
        'Valid machine certificate installed',
        checkResultDetails.valid_machine_cert_installed,
        runComputerPrerequisitesChecks
      );
      renderCheckResult(
        remoteDomainReachableCheckItem,
        false,
        'Remote domain reachable',
        checkResultDetails.remote_domain_reachable,
        runComputerPrerequisitesChecks
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const attemptResult = await runWithRetries(
      () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_PREREQUISITES'), { in_cwa_id: selectedConfig.deviceIdentifier }),
      (result) => {
        const evaluation = evaluateComputerPrereqs(result);
        return evaluation.certPassed && evaluation.responseTimePassed;
      }
    );

    if (attemptResult.ok) {
      const evaluation = evaluateComputerPrereqs(attemptResult.result);
      renderComputerPrereqResults(evaluation);
      updateButtonState();
      return;
    }

    if (attemptResult.error && !attemptResult.result) {
      const errorDetails = `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`;
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
