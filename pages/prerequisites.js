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

  // ---- Main header ----
  const header = createCardContainer(`
    <h2 class="text-xl font-semibold text-rewst-black mb-2">Prerequisites</h2>
    <p id="prereqs-running-status" class="text-rewst-gray mb-6" style="display: none;">Running validation checks...</p>
  `, 'card p-8 mb-8');
  container.appendChild(header);

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
    computer_online: false
  };

  const MAX_CHECK_ATTEMPTS = 3; // Initial run + 2 retries

  let currentUserEmail = null;
  let selectedConfig = null;
  let activeCheckRuns = 0;
  const runningStatus = header.querySelector('#prereqs-running-status');

  function beginCheckRun(statusText = 'Running validation checks...') {
    activeCheckRuns += 1;
    if (runningStatus) {
      runningStatus.textContent = statusText;
      runningStatus.style.display = 'block';
    }
  }

  function endCheckRun() {
    activeCheckRuns = Math.max(0, activeCheckRuns - 1);
    if (runningStatus && activeCheckRuns === 0) {
      runningStatus.style.display = 'none';
    }
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
      () => rewst.runWorkflowSmart('019dc1f6-fc2c-7ec7-8c4a-19d722755c30'),
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
    beginCheckRun();

    try {
      const email = await ensureUserEmail();
      checkStates.email_verification = true;
      renderCheckResult(emailVerificationCheckItem, true, 'Email verification', email);
    } catch (error) {
      checkStates.email_verification = false;
      currentUserEmail = null;
      renderCheckResult(
        emailVerificationCheckItem,
        false,
        'Email verification',
        error.message || 'Workflow execution failed',
        runEmailVerificationCheck
      );
    } finally {
      updateButtonState();
      endCheckRun();
    }
  }

  async function runCaNameCheck() {
    const element = companyCheckElements['ca_name'];
    setCheckLoading(element, 'CA Name');
    beginCheckRun();

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart('019dc183-516c-7a50-bf66-3705e87e3fda'),
        (result) => {
          const data = result?.output || result;
          return !!data?.ca_name;
        }
      );

      if (attemptResult.ok) {
        const data = attemptResult.result?.output || attemptResult.result;
        const value = data?.ca_name;
        checkStates.ca_name = true;
        renderCheckResult(element, true, 'CA Name', `Data: ${value}`);
      } else {
        checkStates.ca_name = false;
        const details = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No CA Name returned after ${attemptResult.attempts} attempts`;
        renderCheckResult(element, false, 'CA Name', details, runCaNameCheck);
      }
    } finally {
      updateButtonState();
      endCheckRun();
    }
  }

  async function runAdDomainCheck() {
    const element = companyCheckElements['ad_domain'];
    setCheckLoading(element, 'AD Domain');
    beginCheckRun();

    try {
      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart('019dc183-516c-7a50-bf66-3705e87e3fda'),
        (result) => {
          const data = result?.output || result;
          return !!data?.ad_domain;
        }
      );

      if (attemptResult.ok) {
        const data = attemptResult.result?.output || attemptResult.result;
        const value = data?.ad_domain;
        checkStates.ad_domain = true;
        renderCheckResult(element, true, 'AD Domain', `Data: ${value}`);
      } else {
        checkStates.ad_domain = false;
        const details = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No AD Domain returned after ${attemptResult.attempts} attempts`;
        renderCheckResult(element, false, 'AD Domain', details, runAdDomainCheck);
      }
    } finally {
      updateButtonState();
      endCheckRun();
    }
  }

  async function runCwmConfigurationCheck() {
    setCheckLoading(cwmCheckItem, 'CWM Configuration');
    selectedConfig = null;
    beginCheckRun();

    try {
      if (!checkStates.email_verification) {
        checkStates.cwm_config = false;
        renderCheckResult(
          cwmCheckItem,
          false,
          'CWM Configuration',
          'Run Email verification first',
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
        () => rewst.runWorkflowSmart('018c459c-206f-780c-94bc-46f98bbb5933', {
          user_principal_name: userEmail
        }),
        (result) => getValidConfigs(result).length > 0
      );

      const validConfigs = getValidConfigs(attemptResult.result);

      if (!attemptResult.ok || validConfigs.length === 0) {
        checkStates.cwm_config = false;
        const details = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `No valid configurations found after ${attemptResult.attempts} attempts`;
        renderCheckResult(cwmCheckItem, false, 'CWM Configuration', details, runCwmConfigurationCheck);
      } else if (validConfigs.length === 1) {
        selectedConfig = validConfigs[0];
        checkStates.cwm_config = true;
        renderCheckResult(cwmCheckItem, true, 'CWM Configuration', `Selected: ${selectedConfig.name}`);
      } else {
        selectedConfig = validConfigs[0];
        checkStates.cwm_config = true;
        renderCheckResult(cwmCheckItem, true, 'CWM Configuration', `Multiple found, selected: ${selectedConfig.name}`);
      }
    } catch (error) {
      checkStates.cwm_config = false;
      currentUserEmail = null;
      renderCheckResult(cwmCheckItem, false, 'CWM Configuration', error.message || 'Workflow execution failed', runCwmConfigurationCheck);
    } finally {
      updateButtonState();
      endCheckRun();
    }
  }

  async function runComputerOnlineCheck() {
    setCheckLoading(computerOnlineCheckItem, 'Computer Online');
    beginCheckRun();

    try {
      if (!selectedConfig || !selectedConfig.deviceIdentifier) {
        checkStates.computer_online = false;
        renderCheckResult(
          computerOnlineCheckItem,
          false,
          'Computer Online',
          'No valid CWM configuration selected',
          runComputerOnlineCheck
        );
        return;
      }

      const attemptResult = await runWithRetries(
        () => rewst.runWorkflowSmart('019dc20b-e6e1-750e-abcd-9814d0c592b6', {
          cwa_computer_id: selectedConfig.deviceIdentifier
        }),
        (result) => !!result?.output?.online
      );

      if (attemptResult.ok) {
        const onlineValue = attemptResult.result?.output?.online;
        checkStates.computer_online = true;
        renderCheckResult(
          computerOnlineCheckItem,
          true,
          'Computer Online',
          `Status: ${onlineValue}`,
          runComputerOnlineCheck
        );
      } else {
        checkStates.computer_online = false;
        const details = attemptResult.error
          ? `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`
          : `Computer not online after ${attemptResult.attempts} attempts`;
        renderCheckResult(computerOnlineCheckItem, false, 'Computer Online', details, runComputerOnlineCheck);
      }
    } catch (error) {
      checkStates.computer_online = false;
      renderCheckResult(computerOnlineCheckItem, false, 'Computer Online', error.message || 'Workflow execution failed', runComputerOnlineCheck);
    } finally {
      updateButtonState();
      endCheckRun();
    }
  }

  // ---- Run workflow and check results ----
  (async () => {
    debugLog('Starting prerequisites checks...');

    // Company checks first
    await runCaNameCheck();
    await runAdDomainCheck();

    // User checks second
    await runEmailVerificationCheck();
    await runCwmConfigurationCheck();
    await runComputerOnlineCheck();
  })();
}
