// ============================================
// PREREQUISITES PAGE (Company + User)
// ============================================

function renderPrerequisitesPage() {
  const container = document.getElementById('page-prerequisites');
  container.innerHTML = '';
  // Wipe the container so we start fresh each time the page is navigated to.

  // Helper: wraps an HTML string in a RewstDOM card element and applies a custom class.
  function createCardContainer(content, className) {
    const card = RewstDOM.createCard(content);
    card.className = className;
    return card;
  }

  const commandDeck = createCardContainer(`
    <div class="prereq-command-row">
      <div class="prereq-command-left"> 
        <div class="prereq-command-badge">
          <span class="material-icons">radar</span>
          <span>Validation Command Deck</span>
        </div>
        <h2 class="prereq-command-title">Systems are scanning for launch authority</h2>
        <p class="prereq-command-copy">
          Every passing check unlocks the next layer of VPN readiness. Watch the sequence harden in real time.
        </p>
      </div>
      <div class="prereq-command-right">
        <div class="prereq-progress-header">
          <span class="prereq-progress-label">Readiness Progress</span>
          <span id="prereq-progress-value" class="prereq-progress-value">0/7</span>
        </div>
        <div class="prereq-progress-track" aria-hidden="true">
          <span id="prereq-progress-fill" class="prereq-progress-fill"></span>
        </div>
        <p id="prereq-cadence-label" class="prereq-cadence-label">Standing by for first validation pulse.</p>
      </div>
    </div>
  `, 'card prereq-command-card');
  container.appendChild(commandDeck);

    // Grab references to the live-updating progress UI elements inside the command deck.
    const progressValueElement = commandDeck.querySelector('#prereq-progress-value');
  const progressFillElement = commandDeck.querySelector('#prereq-progress-fill');
  const cadenceLabelElement = commandDeck.querySelector('#prereq-cadence-label');

  // ---- Checklist items container ----
  const checklistContainer = document.createElement('div');
  checklistContainer.className = 'prereq-checklist';
  container.appendChild(checklistContainer);

    // categorySections holds a reference to each collapsible section's DOM and collapse logic.
  const categorySections = {};
    // How long a completed category stays open before it auto-collapses (ms).
  const CATEGORY_AUTO_COLLAPSE_DELAY_MS = 1200;
    // Holds the setTimeout IDs for pending auto-collapse actions so we can cancel them.
  const categoryAutoCollapseTimers = {};

  function createCategorySection(key, title) {
      // key = e.g. 'company', 'user', 'computer' — used to look up this section later.
    const section = document.createElement('section');
    section.className = 'prereq-category';

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.className = 'prereq-section-header prereq-section-toggle';
    headerBtn.setAttribute('aria-expanded', 'true');
    headerBtn.innerHTML = `
      <h3 class="prereq-section-title">${title}</h3>
      <span class="prereq-section-actions">
        <span class="prereq-section-success-chip" aria-hidden="true">
          <span class="material-icons">task_alt</span>
          <span>Complete</span>
        </span>
        <span class="material-icons prereq-section-toggle-icon">expand_less</span>
      </span>
    `;

    const body = document.createElement('div');
    body.className = 'prereq-category-body';

      // setCollapsed drives the visual open/close state of this section.
      // reason='manual' means the user clicked, 'auto' means all checks passed and the timer fired.
    const setCollapsed = (collapsed, persistState = false, reason = 'system') => {
      section.classList.toggle('is-collapsed', collapsed);
      section.classList.toggle('is-auto-collapsed', collapsed && reason === 'auto');
      headerBtn.setAttribute('aria-expanded', (!collapsed).toString());

      const icon = headerBtn.querySelector('.prereq-section-toggle-icon');
      if (icon) {
        icon.textContent = collapsed ? 'expand_more' : 'expand_less';
      }

      if (persistState) {
        section.dataset.collapseState = collapsed ? 'collapsed' : 'expanded';
      }

      if (reason === 'manual') {
          // User manually toggled — cancel any pending auto-close for this section.
        clearCategoryAutoCollapseTimer(key);
        section.classList.remove('is-auto-collapsed');
      }
    };

    headerBtn.addEventListener('click', () => {
      const collapsed = section.classList.contains('is-collapsed');
      setCollapsed(!collapsed, true, 'manual');
    });

    section.appendChild(headerBtn);
    section.appendChild(body);
    checklistContainer.appendChild(section);

    categorySections[key] = {
      section,
      setCollapsed
    };

    return body;
  }

  // ---- Company checks section ----
  const companyCategoryBody = createCategorySection('company', 'Company Prerequisites');

    // These two checks pull org-level variables (CA Name, AD Domain) from Rewst.
  const companyChecks = [
    { id: 'ca_name', label: 'CA Name' },
    { id: 'ad_domain', label: 'AD Domain' }
  ];

    // Map from check id → the DOM card element for that check (so we can update it later).
  const companyCheckElements = {};

    // Builds a "pending" check card with the given id and label.
  function createCheckCard(id, label) {
    const checkItem = createCardContainer(`
      <div class="prereq-check-icon is-pending">
        <span class="material-icons">schedule</span>
      </div>
      <div class="prereq-check-content">
        <p class="prereq-check-title">${label}</p>
        <p class="prereq-check-detail">Pending - Waiting to start...</p>
      </div>
    `, 'card prereq-check-card');

    checkItem.id = id;
    return checkItem;
  }

  companyChecks.forEach(check => {
    const checkItem = createCheckCard(`check-${check.id}`, check.label);
    companyCategoryBody.appendChild(checkItem);
      // Store the element so individual check functions can update it by id.
    companyCheckElements[check.id] = checkItem;
  });

  // ---- User checks section ----
  const userCategoryBody = createCategorySection('user', 'User Prerequisites');

    // Email verification must pass first; CWM config depends on it.
  const emailVerificationCheckItem = createCheckCard('check-email-verification', 'Email verification');
  userCategoryBody.appendChild(emailVerificationCheckItem);

  const cwmCheckItem = createCheckCard('check-cwm-config', 'CWM Configuration');
  userCategoryBody.appendChild(cwmCheckItem);

  // ---- Computer checks section ----
  const computerCategoryBody = createCategorySection('computer', 'Computer Prerequisites');

    // Computer Online must pass first; the cert check depends on it.
  const computerOnlineCheckItem = createCheckCard('check-computer-online', 'Computer Online');
  computerCategoryBody.appendChild(computerOnlineCheckItem);

    // This check runs against the specific computer identified by the CWM config check.
  const validMachineCertCheckItem = createCheckCard('check-valid-machine-cert', 'Valid machine certificate installed');
  computerCategoryBody.appendChild(validMachineCertCheckItem);

  // ---- Continue button ----
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'prereq-actions';

  const continueButton = document.createElement('button');
  continueButton.className = 'btn-primary prereq-continue-btn is-disabled';
  continueButton.disabled = true;
  const defaultContinueButtonHtml = `
    <span class="material-icons">arrow_forward</span>
    <span>Continue to Manage VPN</span>
  `;
  continueButton.innerHTML = defaultContinueButtonHtml;
  continueButton.addEventListener('click', () => {
      // If a countdown was in progress, cancel it and navigate immediately.
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
    // Tracks the current pass/fail result for each individual check.
    // false = not yet passed, true = passed.
    ca_name: false,
    ad_domain: false,
    email_verification: false,
    cwm_config: false,
    computer_online: false,
    valid_machine_cert_installed: false
  };

    // Workflow checks should wait on a single execution instead of re-running in a retry loop.
  const WORKFLOW_RESPONSE_MAX_WAIT_MS = 5 * 60 * 1000;
    // Cache key used in sessionStorage so passing checks survive a page refresh.
  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';

    // Allow the Rewst app to configure the auto-proceed countdown via APP_CONFIG.
  const configuredCountdown = Number(window.APP_CONFIG?.autoProceedCountdownSeconds);
  const AUTO_PROCEED_COUNTDOWN_SECONDS = Number.isInteger(configuredCountdown) && configuredCountdown > 0
    ? configuredCountdown
    : 3;

    // currentUserEmail is fetched once and reused by multiple checks that need the user's email.
  let currentUserEmail = null;
    // emailLookupInFlight prevents duplicate simultaneous email lookup requests.
  let emailLookupInFlight = null;
    // selectedConfig is the CWM configuration chosen for this user's computer.
  let selectedConfig = null;
    // Timer state for the "auto-proceed in N seconds" countdown shown when all checks pass.
  let autoProceedCountdownTimer = null;
  let autoProceedCountdownValue = AUTO_PROCEED_COUNTDOWN_SECONDS;
  let autoProceedTriggered = false;
    // Stores the human-readable detail string for each check's last result (used for caching).
  const checkResultDetails = {
    ca_name: '',
    ad_domain: '',
    email_verification: '',
    cwm_config: '',
    computer_online: '',
    valid_machine_cert_installed: ''
  };

  const REMEDIATION_CONTEXT_KEY = 'prereqMachineCertRemediationContextV1';
  const REMEDIATION_RETURN_KEY = 'prereqMachineCertRemediationReturnV1';

  const workflowIds = window.WORKFLOW_IDS || {};
    // These checks must ALL pass before the Continue button unlocks.
  const REQUIRED_PASSING_KEYS = [
    'ca_name',
    'ad_domain',
    'email_verification',
    'cwm_config',
    'computer_online',
    'valid_machine_cert_installed'
  ];

  const CATEGORY_CHECK_KEYS = {
    // Maps each collapsible section to the check keys it owns.
    // Used to decide when a section is "complete" and can auto-collapse.
    company: ['ca_name', 'ad_domain'],
    user: ['email_verification', 'cwm_config'],
    computer: ['computer_online', 'valid_machine_cert_installed']
  };

  function getStoredJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      debugWarn(`Failed to parse session key ${key}:`, error);
      return null;
    }
  }

  function clearMachineCertRemediationStorage() {
    try {
      sessionStorage.removeItem(REMEDIATION_CONTEXT_KEY);
      sessionStorage.removeItem(REMEDIATION_RETURN_KEY);
    } catch (error) {
      debugWarn('Failed to clear remediation session state:', error);
    }
  }

  function saveMachineCertRemediationContext() {
    if (!selectedConfig?.deviceIdentifier) return;

    try {
      sessionStorage.setItem(REMEDIATION_CONTEXT_KEY, JSON.stringify({
        checkKey: 'valid_machine_cert_installed',
        checkLabel: 'Valid machine certificate installed',
        cwaId: selectedConfig.deviceIdentifier,
        currentUserEmail,
        selectedConfig,
        checkStates: {
          ca_name: checkStates.ca_name,
          ad_domain: checkStates.ad_domain,
          email_verification: checkStates.email_verification,
          cwm_config: checkStates.cwm_config,
          computer_online: checkStates.computer_online
        },
        checkResultDetails: {
          ca_name: checkResultDetails.ca_name,
          ad_domain: checkResultDetails.ad_domain,
          email_verification: checkResultDetails.email_verification,
          cwm_config: checkResultDetails.cwm_config,
          computer_online: checkResultDetails.computer_online
        }
      }));
    } catch (error) {
      debugWarn('Failed to store remediation context:', error);
    }
  }

  function applyMachineCertResumeContext(context) {
    if (!context || context.checkKey !== 'valid_machine_cert_installed' || !context.selectedConfig?.deviceIdentifier) {
      return false;
    }

    currentUserEmail = context.currentUserEmail || null;
    selectedConfig = context.selectedConfig;
    window.selectedConfig = selectedConfig;

    try {
      sessionStorage.setItem('selectedConfig', JSON.stringify(selectedConfig));
    } catch (error) {
      debugWarn('Failed to persist resumed selected config:', error);
    }

    const resumeKeys = ['ca_name', 'ad_domain', 'email_verification', 'cwm_config', 'computer_online'];
    resumeKeys.forEach((key) => {
      checkStates[key] = context.checkStates?.[key] === true;
      checkResultDetails[key] = context.checkResultDetails?.[key] || '';
    });

    renderCheckResult(companyCheckElements['ca_name'], checkStates.ca_name, 'CA Name', checkResultDetails.ca_name, runCaNameCheck);
    renderCheckResult(companyCheckElements['ad_domain'], checkStates.ad_domain, 'AD Domain', checkResultDetails.ad_domain, runAdDomainCheck);
    renderCheckResult(
      emailVerificationCheckItem,
      checkStates.email_verification,
      'Email verification',
      checkResultDetails.email_verification,
      () => runEmailVerificationCheck({ continuePipeline: true })
    );
    renderCheckResult(cwmCheckItem, checkStates.cwm_config, 'CWM Configuration', checkResultDetails.cwm_config, runCwmConfigurationCheck);
    renderCheckResult(computerOnlineCheckItem, checkStates.computer_online, 'Computer Online', checkResultDetails.computer_online, runComputerOnlineCheck);
    setCheckPending(validMachineCertCheckItem, 'Valid machine certificate installed', 'Resuming after remediation...');
    return true;
  }

  function clearCategoryAutoCollapseTimer(categoryKey) {
      // Cancel a pending auto-collapse if the user manually interacted or checks changed.
    const timerId = categoryAutoCollapseTimers[categoryKey];
    if (timerId) {
      clearTimeout(timerId);
      delete categoryAutoCollapseTimers[categoryKey];
    }
  }

  function updateCategoryCollapseStates() {
      // Called after every check result update. Marks each section as complete or not,
      // and schedules/cancels the delayed auto-collapse as appropriate.
    Object.entries(CATEGORY_CHECK_KEYS).forEach(([categoryKey, checkKeys]) => {
      const category = categorySections[categoryKey];
      if (!category) return;

      const isComplete = checkKeys.every((key) => checkStates[key] === true);
      category.section.classList.toggle('is-complete', isComplete);

      if (isComplete) {
        const isPinnedOpen = category.section.dataset.collapseState === 'expanded';

        if (isPinnedOpen) {
            // User forced this section open; don't auto-close it.
          clearCategoryAutoCollapseTimer(categoryKey);
          category.setCollapsed(false, false, 'system');
          return;
        }

        if (category.section.classList.contains('is-collapsed')) {
            // Already collapsed (possibly user-collapsed); keep it that way.
          clearCategoryAutoCollapseTimer(categoryKey);
          category.setCollapsed(true, false, 'auto');
          return;
        }

        if (!categoryAutoCollapseTimers[categoryKey]) {
            // Section is open and complete — schedule the linger-then-collapse.
          categoryAutoCollapseTimers[categoryKey] = setTimeout(() => {
            delete categoryAutoCollapseTimers[categoryKey];

            const latestCategory = categorySections[categoryKey];
            if (!latestCategory) return;

            const stillComplete = checkKeys.every((key) => checkStates[key] === true);
            const stillPinnedOpen = latestCategory.section.dataset.collapseState === 'expanded';

            if (stillComplete && !stillPinnedOpen) {
              latestCategory.setCollapsed(true, false, 'auto');
            }
          }, CATEGORY_AUTO_COLLAPSE_DELAY_MS);
        }
      } else {
          // Not complete: make sure the section is expanded and has no completion state.
        clearCategoryAutoCollapseTimer(categoryKey);
        category.setCollapsed(false, false, 'system');
        category.section.classList.remove('is-auto-collapsed');
        delete category.section.dataset.collapseState;
      }
    });
  }

  function updatePrereqCommandDeck() {
      // Recalculates the progress bar percentage and status text based on current checkStates.
    const totalChecks = Object.keys(checkStates).length;
    const completedChecks = Object.values(checkStates).filter((state) => state === true).length;
    const percent = Math.round((completedChecks / totalChecks) * 100);

    if (progressValueElement) {
      progressValueElement.textContent = `${completedChecks}/${totalChecks}`;
    }

    if (progressFillElement) {
      progressFillElement.style.width = `${percent}%`;
      progressFillElement.classList.toggle('is-complete', completedChecks === totalChecks);
    }

    if (cadenceLabelElement) {
      if (completedChecks === 0) {
        cadenceLabelElement.textContent = 'Standing by for first validation pulse.';
      } else if (completedChecks < totalChecks) {
        cadenceLabelElement.textContent = `${percent}% secured. Continuing scan cycle.`;
      } else {
        cadenceLabelElement.textContent = 'All prerequisites verified. VPN setup lane is unlocked.';
      }
    }
  }

  function getWorkflowId(key) {
      // Looks up a workflow ID by key from the local config.
      // Throws a helpful error if the developer forgot to add it to workflow-ids.local.js.
    const id = workflowIds[key];
    if (!id) {
      throw new Error(`Missing workflow ID for ${key}. Set it in src/workflow-ids.local.js`);
    }
    return id;
  }

  function getCachedPrereqs() {
      // Returns the cached check results from sessionStorage, or null if none exist.
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
      // When all checks pass, save results to sessionStorage so the user doesn't have to
      // re-run checks if they navigate away and come back in the same browser session.
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
      // Restores check UI from a previously cached result. Returns true if it worked,
      // false if the cache is invalid or incomplete (triggering a fresh run).
    const states = cache?.checkStates;
    const details = cache?.checkResultDetails;
    if (!states || !details) return false;

    const allPassed = REQUIRED_PASSING_KEYS.every(key => states[key] === true);
    if (!allPassed) return false;

    REQUIRED_PASSING_KEYS.forEach(key => {
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
    updateButtonState();
    return true;
  }

  function formatDuration(ms) {
      // Converts milliseconds to a human-readable string like "2m 5s" or "45s".
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setCheckLoading(element, label, details = 'Validating...', statusText = 'Running') {
      // Puts a check card into the "running" state with a spinner icon.
    renderCheckResult(element, false, label, details, null, {
      statusType: 'running',
      statusText
    });
  }

  function setCheckPending(element, label, details = 'Waiting on previous checks...') {
      // Puts a check card into a grey "pending" state — used before the check has started.
    renderCheckResult(element, false, label, details, null, {
      statusType: 'pending',
      statusText: 'Pending'
    });
  }

  function renderCheckResult(element, passed, label, details = '', onRetry = null, options = {}) {
      // Core rendering function — updates a check card's icon, color, status text,
      // and optional retry button. Also updates the progress bar and category collapse state.
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
    const statusText = options.statusText || (statusType === 'passed'
      ? 'Passed'
      : statusType === 'info'
        ? 'Informational'
        : statusType === 'pending'
          ? 'Pending'
          : statusType === 'running'
            ? 'Running'
            : 'Failed');
    const iconAnimationClass = statusType === 'running' ? 'prereq-icon-spin' : '';
    const showRetry = !passed && typeof onRetry === 'function';
    const statusModifierClass = `is-${statusType}`;

    element.classList.remove('is-passed', 'is-failed', 'is-info', 'is-pending', 'is-running');
    element.classList.add(statusModifierClass);

    element.innerHTML = `
      <div class="prereq-check-icon ${statusModifierClass}">
        <span class="material-icons ${iconAnimationClass}">${statusIcon}</span>
      </div>
      <div class="prereq-check-content">
        <p class="prereq-check-title">${label}</p>
        <p class="prereq-check-detail">${statusText}${details ? ` - ${details}` : ''}</p>
      </div>
      ${showRetry ? '<button class="btn-secondary btn-sm prereq-retry-btn"><span class="material-icons">refresh</span><span>Re-check</span></button>' : ''}
    `;

    if (showRetry) {
      const retryBtn = element.querySelector('.prereq-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', onRetry);
      }
    }

    updateCategoryCollapseStates();
    updatePrereqCommandDeck();
  }

  function hasAutoNavigatedToVpnAlready() {
      // Checks sessionStorage to prevent auto-navigating to VPN setup more than once per session.
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
      // Starts the N-second countdown that automatically navigates to VPN setup after all checks pass.
      // Guards against running more than once or re-running if already triggered this session.
    if (autoProceedTriggered || autoProceedCountdownTimer || hasAutoNavigatedToVpnAlready()) {
      return;
    }

    autoProceedCountdownValue = AUTO_PROCEED_COUNTDOWN_SECONDS;
    continueButton.disabled = false;
    continueButton.classList.remove('is-disabled');
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
      // Re-evaluates whether the Continue button should be enabled.
      // Also starts or stops the auto-proceed countdown, and notifies the sidebar nav.
    const allPassed = REQUIRED_PASSING_KEYS.every(key => checkStates[key] === true);

    if (!allPassed) {
      stopAutoProceedCountdown(true);
      continueButton.innerHTML = defaultContinueButtonHtml;
    }

    continueButton.disabled = !allPassed;
    if (allPassed) {
      continueButton.classList.remove('is-disabled');
    } else {
      continueButton.classList.add('is-disabled');
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

  function isWorkflowTimeoutError(error) {
      // Rewst surfaces timeouts via the error message after the shared 5-minute wait expires.
    const message = error?.message || '';
    return /timeout/i.test(message);
  }

  function formatWorkflowProgressDetails(status, numSuccessfulTasks, workflowKey = null) {
      // Converts raw workflow status updates into user-facing loading text.
    const resolvedStep = workflowKey
      ? resolveWorkflowStepByTaskCount(workflowKey, numSuccessfulTasks)
      : null;
    const configuredLabel = resolvedStep?.step?.progressLabel || null;
    if (configuredLabel) {
      const taskSuffix = Number.isFinite(numSuccessfulTasks)
        ? ` Successful tasks: ${numSuccessfulTasks}.`
        : '';
      return `${configuredLabel}.${taskSuffix}`;
    }

    const normalizedStatus = typeof status === 'string' && status.trim()
      ? status.trim().replace(/_/g, ' ').toLowerCase()
      : 'processing';
    const taskSuffix = Number.isFinite(numSuccessfulTasks)
      ? ` Successful tasks: ${numSuccessfulTasks}.`
      : '';
    return `Workflow is still ${normalizedStatus}. Waiting up to ${formatDuration(WORKFLOW_RESPONSE_MAX_WAIT_MS)} for a response.${taskSuffix}`;
  }

  async function runSingleAttempt(task, operationName = 'workflow') {
      // Executes the task once and lets the underlying Rewst client handle the long poll.
    const startedAt = Date.now();

    try {
      debugLog(`[Workflow] ${operationName}: starting single attempt`);
      const result = await task();
      const elapsedMs = Date.now() - startedAt;
      debugLog(`[Workflow] ${operationName}: completed in ${elapsedMs}ms`);
      return { ok: true, result, error: null, elapsedMs, timedOut: false };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      debugWarn(`[Workflow] ${operationName}: failed after ${elapsedMs}ms`, error);
      return {
        ok: false,
        result: null,
        error,
        elapsedMs,
        timedOut: isWorkflowTimeoutError(error)
      };
    }
  }

  function buildResultDataCandidates(result) {
      // Rewst workflow outputs can be nested in various shapes depending on how they're configured.
      // This function returns a list of candidate objects to search for output fields in.
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
      // Searches across all candidate output objects for the first non-null value
      // matching any of the given field names. Used to handle varying workflow output shapes.
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
      // Normalizes loosely-typed "boolean" values from workflow outputs.
      // Workflows may return 'true', 'yes', '1', 'online', etc. — this handles all of them.
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
      // Convenience wrapper: finds a field in the workflow result and parses it as a boolean.
    const rawValue = getFirstFieldValue(result, fieldNames);
    return {
      rawValue,
      parsed: parseBooleanLike(rawValue)
    };
  }

  async function ensureUserEmail() {
      // Fetches the current user's email from the USER_EMAIL workflow.
      // Multiple callers can await this simultaneously — only one request is made.
    if (currentUserEmail) return currentUserEmail;

    if (!emailLookupInFlight) {
        // Kick off the lookup and store the promise so concurrent callers share it.
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

        const attemptResult = await runSingleAttempt(
          () => rewst.runWorkflowSmart(getWorkflowId('USER_EMAIL'), {}, {
            onProgress: (status, numSuccessfulTasks) => {
              setCheckLoading(
                emailVerificationCheckItem,
                'Email verification',
                formatWorkflowProgressDetails(status, numSuccessfulTasks),
                'Communicating with Rewst'
              );
            }
          }),
          'Email verification lookup'
        );

        const email = extractUserEmail(attemptResult.result);
        if (!attemptResult.ok) {
          throw attemptResult.error || new Error(`Could not determine current user email after ${formatDuration(attemptResult.elapsedMs || 0)}`);
        }

        if (!email) {
          throw new Error(`Workflow completed without returning a user email after ${formatDuration(attemptResult.elapsedMs || 0)}`);
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
      // Fire-and-forget call to kick off email lookup in the background so it's ready
      // by the time runEmailVerificationCheck actually needs it.
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
      // Fetches the ca_name org variable from Rewst. This is a company-level setting
      // that must be configured before VPN certificates can work.
    const element = companyCheckElements['ca_name'];
    setCheckLoading(element, 'CA Name', 'Fetching company configuration data...');
    checkResultDetails.ca_name = '';

    try {
      const attemptResult = await runSingleAttempt(
        () => rewst.getOrgVariable('ca_name'),
        'Company prerequisite: CA Name'
      );

      if (attemptResult.ok && attemptResult.result) {
        const value = attemptResult.result;
        checkStates.ca_name = true;
        checkResultDetails.ca_name = `Data: ${value}`;
        renderCheckResult(element, true, 'CA Name', checkResultDetails.ca_name);
      } else {
        checkStates.ca_name = false;
        checkResultDetails.ca_name = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : 'No CA Name returned';
        clearCachedPrereqs();
        renderCheckResult(element, false, 'CA Name', checkResultDetails.ca_name, runCaNameCheck);
      }
    } finally {
      updateButtonState();
    }
  }

  async function runAdDomainCheck() {
      // Fetches the ad_domain org variable. Required for domain-joined VPN connections.
    const element = companyCheckElements['ad_domain'];
    setCheckLoading(element, 'AD Domain', 'Fetching company configuration data...');
    checkResultDetails.ad_domain = '';

    try {
      const attemptResult = await runSingleAttempt(
        () => rewst.getOrgVariable('ad_domain'),
        'Company prerequisite: AD Domain'
      );

      if (attemptResult.ok && attemptResult.result) {
        const value = attemptResult.result;
        checkStates.ad_domain = true;
        checkResultDetails.ad_domain = `Data: ${value}`;
        renderCheckResult(element, true, 'AD Domain', checkResultDetails.ad_domain);
      } else {
        checkStates.ad_domain = false;
        checkResultDetails.ad_domain = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : 'No AD Domain returned';
        clearCachedPrereqs();
        renderCheckResult(element, false, 'AD Domain', checkResultDetails.ad_domain, runAdDomainCheck);
      }
    } finally {
      updateButtonState();
    }
  }

  async function runCwmConfigurationCheck() {
      // Asks a Rewst workflow for the user's CWM (ConnectWise Manage) device configurations.
      // If exactly one is found, it's selected automatically. If multiple are found, the first is used.
      // The selectedConfig is stored globally for downstream checks (computer online, cert check).
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

      const attemptResult = await runSingleAttempt(
        () => rewst.runWorkflowSmart(getWorkflowId('CWM_CONFIGURATIONS'), {
          user_principal_name: userEmail
        }, {
          onProgress: (status, numSuccessfulTasks) => {
            setCheckLoading(
              cwmCheckItem,
              'CWM Configuration',
              formatWorkflowProgressDetails(status, numSuccessfulTasks),
              'Communicating with CWM'
            );
          }
        }),
        'User prerequisite: CWM Configuration'
      );

      const validConfigs = getValidConfigs(attemptResult.result);

      if (!attemptResult.ok || validConfigs.length === 0) {
        checkStates.cwm_config = false;
        checkResultDetails.cwm_config = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : 'Workflow completed without returning any valid configurations';
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
      // Polls a Rewst workflow to see if the target computer (identified by its CWM device ID)
      // is currently online. Retries for up to 5 minutes because the machine may be asleep.
      // If it comes online, immediately kicks off the computer prerequisite checks.
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

      const attemptResult = await runSingleAttempt(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_ONLINE'), {
          cwa_computer_id: selectedConfig.deviceIdentifier
        }, {
          onProgress: (status, numSuccessfulTasks) => {
            setCheckLoading(
              computerOnlineCheckItem,
              'Computer Online',
              formatWorkflowProgressDetails(status, numSuccessfulTasks),
              'Communicating with your PC'
            );
          }
        }),
        'User prerequisite: Computer Online'
      );

      if (attemptResult.ok && getBooleanFieldValue(
        attemptResult.result,
        ['online', 'is_online', 'computer_online', 'isOnline']
      ).parsed === true) {
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
          ? attemptResult.error.message || 'Workflow execution failed'
          : `Computer is still offline after ${formatDuration(attemptResult.elapsedMs || 0)}`;
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
      // Parses a value as a positive integer. Returns null for anything that isn't one.
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
      // Interprets the raw workflow result for the computer prerequisite check.
      // Looks for ValidCertCount — must be >= 1 for the cert check to pass.
    const directInfo = getFirstFieldValue(result, ['prereq_info', 'prereqInfo']);
    const data = directInfo && typeof directInfo === 'object'
      ? directInfo
      : (buildResultDataCandidates(result).find(candidate =>
          Object.prototype.hasOwnProperty.call(candidate, 'ValidCertCount')
        ) || {});

    const validCertCountRaw = data?.ValidCertCount;
    const validCertCount = Number(validCertCountRaw);
    const certPassed = Number.isFinite(validCertCount) && validCertCount >= 1;

    return {
      certPassed,
      validCertCountRaw,
      validCertCount: Number.isFinite(validCertCount) ? validCertCount : null
    };
  }

  function getWorkflowExecutionId(result) {
      // Extracts an execution ID from different result shapes.
    const candidates = [
      result?.execution?.id,
      result?.executionId,
      result?.id,
      result?.output?.executionId,
      result?.execution?.executionId
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  async function resolveComputerPrereqEvaluation(result, operationName = 'Computer prerequisite checks') {
      // Some runs finish but initial output reads can be stale/missing.
      // If ValidCertCount is missing, do one silent refresh by execution ID.
    const initialEvaluation = evaluateComputerPrereqs(result);
    if (initialEvaluation.validCertCount !== null) {
      return initialEvaluation;
    }

    const executionId = getWorkflowExecutionId(result);
    if (!executionId) {
      return initialEvaluation;
    }

    try {
      debugWarn(`[Workflow] ${operationName}: ValidCertCount missing; refreshing execution output for ${executionId}`);
      await sleep(1200);
      const refreshedResult = await rewst.getExecutionStatus(executionId, true, true);
      const refreshedEvaluation = evaluateComputerPrereqs(refreshedResult);
      if (refreshedEvaluation.validCertCount !== null) {
        refreshedEvaluation.usedFreshExecutionRead = true;
        return refreshedEvaluation;
      }
    } catch (error) {
      debugWarn(`[Workflow] ${operationName}: refresh read failed for execution ${executionId}`, error);
    }

    return initialEvaluation;
  }

  function clearComputerPrereqStateAndRenderBlocked() {
      // Resets the computer check card to "pending" when the Computer Online check hasn't passed yet.
    checkStates.valid_machine_cert_installed = false;
    checkResultDetails.valid_machine_cert_installed = 'Waiting for Computer Online to pass';

    setCheckPending(
      validMachineCertCheckItem,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed
    );
    clearCachedPrereqs();
  }

  function renderComputerPrereqResults(evaluation, attemptInfo = null) {
      // Takes the evaluated computer prereq data and updates the cert check card.
    checkStates.valid_machine_cert_installed = evaluation.certPassed;

    let certDetails = evaluation.certPassed
      ? `ValidCertCount: ${evaluation.validCertCountRaw}`
      : `ValidCertCount must be 1 or higher (received: ${evaluation.validCertCountRaw ?? 'none'})`;

    if (evaluation.usedFreshExecutionRead) {
      certDetails += ' (refreshed execution output)';
    }

    const failureSuffix = attemptInfo ? ` after ${attemptInfo.attempts} attempts` : '';

    checkResultDetails.valid_machine_cert_installed = evaluation.certPassed
      ? certDetails
      : certDetails + failureSuffix;

    renderCheckResult(
      validMachineCertCheckItem,
      evaluation.certPassed,
      'Valid machine certificate installed',
      checkResultDetails.valid_machine_cert_installed,
      runComputerPrerequisitesChecks
    );

    if (!evaluation.certPassed && evaluation.validCertCount === 0 && selectedConfig?.deviceIdentifier) {
      saveMachineCertRemediationContext();
      switchPage('remediation');
    }
  }

  async function runComputerPrerequisitesChecks() {
      // Runs the COMPUTER_PREREQUISITES workflow to check cert count and domain reachability.
      // This waits on one execution for up to 5 minutes instead of re-running the workflow.
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
    checkResultDetails.valid_machine_cert_installed = '';

    if (!selectedConfig || !selectedConfig.deviceIdentifier) {
      checkStates.valid_machine_cert_installed = false;
      checkResultDetails.valid_machine_cert_installed = 'Missing CWA ID from selected configuration';

      setCheckPending(
        validMachineCertCheckItem,
        'Valid machine certificate installed',
        checkResultDetails.valid_machine_cert_installed
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const attemptResult = await runSingleAttempt(
      () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_PREREQUISITES'), { in_cwa_id: selectedConfig.deviceIdentifier }, {
        onProgress: (status, numSuccessfulTasks) => {
          setCheckLoading(
            validMachineCertCheckItem,
            'Valid machine certificate installed',
            formatWorkflowProgressDetails(status, numSuccessfulTasks, 'COMPUTER_PREREQUISITES'),
            'Communicating with your PC'
          );
        }
      }),
      'Computer prerequisite checks'
    );

    if (attemptResult.ok) {
      const evaluation = await resolveComputerPrereqEvaluation(attemptResult.result);
      renderComputerPrereqResults(evaluation);
      updateButtonState();
      return;
    }

    if (attemptResult.error && !attemptResult.result) {
      const errorDetails = attemptResult.error.message || 'Workflow execution failed';
      checkStates.valid_machine_cert_installed = false;
      checkResultDetails.valid_machine_cert_installed = errorDetails;

      renderCheckResult(
        validMachineCertCheckItem,
        false,
        'Valid machine certificate installed',
        errorDetails,
        runComputerPrerequisitesChecks
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const evaluation = await resolveComputerPrereqEvaluation(attemptResult.result);
    renderComputerPrereqResults(evaluation, attemptResult);
    clearCachedPrereqs();
    updateButtonState();
  }

  // ---- Run workflow and check results ----
  (async () => {
      // This is where everything actually kicks off. All checks run in sequence because each
      // step depends on the one before it (company → user email → CWM config → computer).
    debugLog('Starting prerequisites checks...');

    setCheckPending(companyCheckElements['ca_name'], 'CA Name', 'Queued to start.');
    setCheckPending(companyCheckElements['ad_domain'], 'AD Domain', 'Waiting for CA Name to complete.');
    setCheckPending(emailVerificationCheckItem, 'Email verification', 'Waiting for company checks to complete.');
    setCheckPending(cwmCheckItem, 'CWM Configuration', 'Waiting for Email verification to pass.');
    setCheckPending(computerOnlineCheckItem, 'Computer Online', 'Waiting for CWM Configuration to complete.');
    setCheckPending(validMachineCertCheckItem, 'Valid machine certificate installed', 'Waiting for Computer Online to pass.');  

    // Start user email lookup immediately so it is ready when the check is reached.
    startUserEmailPrefetch();

    const remediationReturn = getStoredJson(REMEDIATION_RETURN_KEY);
    if (applyMachineCertResumeContext(remediationReturn)) {
      try {
        sessionStorage.removeItem(REMEDIATION_RETURN_KEY);
      } catch (error) {
        debugWarn('Failed to clear remediation return context:', error);
      }
      await runComputerPrerequisitesChecks();
      updateButtonState();
      return;
    }

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

    // Computer checks last — Computer Online must pass before the cert check runs.
    await runComputerOnlineCheck();
  })();
}
