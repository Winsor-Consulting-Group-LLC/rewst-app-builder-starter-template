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
    <div class="prereq-command-badge">
      <span class="material-icons">radar</span>
      <span>Validation Command Deck</span>
    </div>
    <div class="prereq-command-row">
      <div class="prereq-command-left">
        <h2 class="prereq-command-title">Checking your system for VPN readiness</h2>
        <p class="prereq-command-copy">
          Each check confirms your device is ready for VPN setup. This usually completes in just a moment.
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
        <p id="prereq-cadence-label" class="prereq-cadence-label">Starting checks...</p>
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

    // These checks pull org-level variables from Rewst.
  const companyChecks = [
    { id: 'ca_name', label: 'CA Name', variableKey: 'ca_name' },
    { id: 'ad_domain', label: 'AD Domain', variableKey: 'ad_domain' },
    { id: 'vpn_adapter_name', label: 'VPN Adapter Name', variableKey: 'vpn_adapter_name' },
    { id: 'vpn_server_address', label: 'VPN Server Address', variableKey: 'vpn_server_address' },
    { id: 'vpn_remote_networks', label: 'VPN Remote Networks', variableKey: 'vpn_remote_networks' },
    { id: 'vpn_nameservers', label: 'VPN Nameservers', variableKey: 'vpn_nameservers' },
    { id: 'vpn_remote_domain', label: 'VPN Remote Domain', variableKey: 'vpn_remote_domain' }
  ];
  const COMPANY_CHECK_KEYS = companyChecks.map((check) => check.id);

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

    switchPage('vpnstatus');
  });

  buttonContainer.appendChild(continueButton);
  container.appendChild(buttonContainer);

  const checkStates = {
    // Tracks the current pass/fail result for each individual check.
    // false = not yet passed, true = passed.
    ca_name: false,
    ad_domain: false,
    vpn_adapter_name: false,
    vpn_server_address: false,
    vpn_remote_networks: false,
    vpn_nameservers: false,
    vpn_remote_domain: false,
    email_verification: false,
    cwm_config: false,
    computer_online: false,
    valid_machine_cert_installed: false
  };

    // Workflow checks should wait on a single execution instead of re-running in a retry loop.
  const WORKFLOW_RESPONSE_MAX_WAIT_MS = 5 * 60 * 1000;
    // Cache key used in sessionStorage so passing checks survive a page refresh.
  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';
  const VPN_SETUP_CACHE_KEY = 'vpnSetupChecksCacheV1';

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
    vpn_adapter_name: '',
    vpn_server_address: '',
    vpn_remote_networks: '',
    vpn_nameservers: '',
    vpn_remote_domain: '',
    email_verification: '',
    cwm_config: '',
    computer_online: '',
    valid_machine_cert_installed: ''
  };
  let latestVpnConnections = null;
  let latestVpnRemoteNetworks = null;
  let latestVpnNameservers = null;

  const REMEDIATION_CONTEXT_KEY = 'prereqMachineCertRemediationContextV1';
  const REMEDIATION_RETURN_KEY = 'prereqMachineCertRemediationReturnV1';

  const workflowIds = window.WORKFLOW_IDS || {};
    // These checks must ALL pass before the Continue button unlocks.
  const REQUIRED_PASSING_KEYS = [
    ...COMPANY_CHECK_KEYS,
    'email_verification',
    'cwm_config',
    'computer_online',
    'valid_machine_cert_installed'
  ];

  const CATEGORY_CHECK_KEYS = {
    // Maps each collapsible section to the check keys it owns.
    // Used to decide when a section is "complete" and can auto-collapse.
    company: COMPANY_CHECK_KEYS,
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
          vpn_adapter_name: checkStates.vpn_adapter_name,
          vpn_server_address: checkStates.vpn_server_address,
          vpn_remote_networks: checkStates.vpn_remote_networks,
          vpn_nameservers: checkStates.vpn_nameservers,
          vpn_remote_domain: checkStates.vpn_remote_domain,
          email_verification: checkStates.email_verification,
          cwm_config: checkStates.cwm_config,
          computer_online: checkStates.computer_online
        },
        checkResultDetails: {
          ca_name: checkResultDetails.ca_name,
          ad_domain: checkResultDetails.ad_domain,
          vpn_adapter_name: checkResultDetails.vpn_adapter_name,
          vpn_server_address: checkResultDetails.vpn_server_address,
          vpn_remote_networks: checkResultDetails.vpn_remote_networks,
          vpn_nameservers: checkResultDetails.vpn_nameservers,
          vpn_remote_domain: checkResultDetails.vpn_remote_domain,
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

    const resumeKeys = [...COMPANY_CHECK_KEYS, 'email_verification', 'cwm_config', 'computer_online'];
    resumeKeys.forEach((key) => {
      checkStates[key] = context.checkStates?.[key] === true;
      checkResultDetails[key] = context.checkResultDetails?.[key] || '';
    });

    companyChecks.forEach((check) => {
      renderCheckResult(
        companyCheckElements[check.id],
        checkStates[check.id],
        check.label,
        checkResultDetails[check.id],
        getCompanyCheckRetryHandler(check.id)
      );
    });
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
      // Company/User/Computer are weighted 25/35/40 to reflect real-world completion time.
    const categoryWeights = { company: 25, user: 35, computer: 40 };
    let weightedPercent = 0;
    let totalChecks = 0;
    let completedChecks = 0;

    Object.entries(CATEGORY_CHECK_KEYS).forEach(([category, keys]) => {
      const passed = keys.filter((key) => checkStates[key] === true).length;
      weightedPercent += (passed / keys.length) * (categoryWeights[category] || 0);
      totalChecks += keys.length;
      completedChecks += passed;
    });

    const percent = Math.round(weightedPercent);
    const allPassed = completedChecks === totalChecks;

    if (progressValueElement) {
      progressValueElement.textContent = `${percent}%`;
    }

    if (progressFillElement) {
      progressFillElement.style.width = `${percent}%`;
      progressFillElement.classList.toggle('is-complete', allPassed);
    }

    if (cadenceLabelElement) {
      if (percent === 0) {
        cadenceLabelElement.textContent = 'Starting checks...';
      } else if (!allPassed) {
        cadenceLabelElement.textContent = `${percent}% complete.`;
      } else {
        cadenceLabelElement.textContent = "All checks passed. You're ready to continue.";
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

  function collectDeepObjects(root) {
    const results = [];
    const stack = [root];
    const visited = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;
      if (visited.has(current)) continue;
      visited.add(current);
      results.push(current);

      if (Array.isArray(current)) {
        current.forEach((value) => {
          if (value && typeof value === 'object') stack.push(value);
        });
      } else {
        Object.values(current).forEach((value) => {
          if (value && typeof value === 'object') stack.push(value);
        });
      }
    }

    return results;
  }

  function uniqueNormalizedStrings(values) {
    const seen = new Set();
    const ordered = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(text);
    });
    return ordered;
  }

  function extractVpnNetworksFromResult(workflowResult, vpnConnections = null) {
    const prefixes = [];
    const cidrPattern = /\b\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/g;

    const objects = collectDeepObjects(workflowResult);
    objects.forEach((obj) => {
      if (Array.isArray(obj)) return;

      if (obj.DestinationPrefix) {
        const values = Array.isArray(obj.DestinationPrefix) ? obj.DestinationPrefix : [obj.DestinationPrefix];
        values.forEach((value) => {
          const text = String(value || '').trim();
          if (text) prefixes.push(text);
        });
      }

      if (typeof obj.CimInstanceProperties === 'string') {
        const matches = obj.CimInstanceProperties.match(cidrPattern);
        if (matches) prefixes.push(...matches);
      }
    });

    const routeCandidates = Array.isArray(vpnConnections?.Routes) ? vpnConnections.Routes : [];
    routeCandidates.forEach((route) => {
      if (route?.DestinationPrefix) {
        prefixes.push(String(route.DestinationPrefix));
      }
      if (typeof route?.CimInstanceProperties === 'string') {
        const matches = route.CimInstanceProperties.match(cidrPattern);
        if (matches) prefixes.push(...matches);
      }
    });

    const unique = uniqueNormalizedStrings(prefixes);
    return unique.length > 0 ? unique : null;
  }

  function extractVpnNameserversFromResult(workflowResult, vpnConnections = null) {
    const adapterName = String(vpnConnections?.Name || '').trim().toLowerCase();
    const candidates = [];

    if (Array.isArray(vpnConnections?.ServerList) && vpnConnections.ServerList.length > 0) {
      candidates.push(...vpnConnections.ServerList.map(String));
    }

    const objects = collectDeepObjects(workflowResult);
    objects.forEach((obj) => {
      if (Array.isArray(obj)) return;
      if (!Array.isArray(obj.ServerAddresses)) return;

      const alias = String(obj.InterfaceAlias || '').trim().toLowerCase();
      const aliasLooksVpn = alias.includes('vpn');
      const aliasMatchesAdapter = adapterName && alias === adapterName;
      if (aliasLooksVpn || aliasMatchesAdapter) {
        candidates.push(...obj.ServerAddresses.map(String));
      }
    });

    const unique = uniqueNormalizedStrings(candidates);
    return unique.length > 0 ? unique : null;
  }

  function persistVpnSetupSnapshot(vpnConnections, statusText = '', workflowResult = null, overrideNetworks = null, overrideNameservers = null) {
    if (!selectedConfig?.deviceIdentifier) return;
    latestVpnConnections = vpnConnections || {};

    const vpnRemoteNetworks = overrideNetworks !== null ? overrideNetworks : extractVpnNetworksFromResult(workflowResult, vpnConnections);
    const vpnNameservers = overrideNameservers !== null ? overrideNameservers : extractVpnNameserversFromResult(workflowResult, vpnConnections);
    latestVpnRemoteNetworks = vpnRemoteNetworks;
    latestVpnNameservers = vpnNameservers;

    try {
      sessionStorage.setItem(VPN_SETUP_CACHE_KEY, JSON.stringify({
        computerId: selectedConfig.deviceIdentifier,
        vpnConnections: vpnConnections || {},
        vpnRemoteNetworks: vpnRemoteNetworks || null,
        vpnNameservers: vpnNameservers || null,
        statusText,
        lastUpdatedAt: new Date().toISOString()
      }));
    } catch (error) {
      debugWarn('Failed to persist VPN setup snapshot:', error);
    }
  }

  function clearVpnSetupSnapshot() {
    latestVpnConnections = null;
    latestVpnRemoteNetworks = null;
    latestVpnNameservers = null;
    try {
      sessionStorage.removeItem(VPN_SETUP_CACHE_KEY);
    } catch (error) {
      debugWarn('Failed to clear VPN setup snapshot:', error);
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
        currentUserEmail,
        vpnConnections: latestVpnConnections,
        vpnRemoteNetworks: latestVpnRemoteNetworks,
        vpnNameservers: latestVpnNameservers
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

    if (cache.vpnConnections !== undefined && selectedConfig?.deviceIdentifier) {
      persistVpnSetupSnapshot(
        cache.vpnConnections,
        'Adapter status restored from cached prerequisite pass.',
        null,
        cache.vpnRemoteNetworks || null,
        cache.vpnNameservers || null
      );
    }

    companyChecks.forEach((check) => {
      renderCheckResult(companyCheckElements[check.id], true, check.label, checkResultDetails[check.id]);
    });
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

  function updateCheckLoadingText(element, label, details = 'Validating...', statusText = 'Running') {
      // Progress callbacks should only update the running detail line so card animations do not replay.
    const detailElement = element?.querySelector('.prereq-check-detail');
    const titleElement = element?.querySelector('.prereq-check-title');

    if (element?.classList.contains('is-running') && detailElement && titleElement && titleElement.textContent === label) {
      detailElement.textContent = `${statusText}${details ? ` - ${details}` : ''}`;
      return;
    }

    setCheckLoading(element, label, details, statusText);
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
    const isCompanyCheck = !!(element?.id && /^check-(ca_name|ad_domain|vpn_adapter_name|vpn_server_address|vpn_remote_networks|vpn_nameservers|vpn_remote_domain)$/.test(element.id));
    const companyFailureNote = (!passed && statusType === 'failed' && isCompanyCheck)
      ? ' Contact the Help Desk for additional guidance on this company-managed setting.'
      : '';

    element.classList.remove('is-passed', 'is-failed', 'is-info', 'is-pending', 'is-running');
    element.classList.add(statusModifierClass);

    element.innerHTML = `
      <div class="prereq-check-icon ${statusModifierClass}">
        <span class="material-icons ${iconAnimationClass}">${statusIcon}</span>
      </div>
      <div class="prereq-check-content">
        <p class="prereq-check-title">${label}</p>
        <p class="prereq-check-detail">${statusText}${details ? ` - ${details}` : ''}${companyFailureNote}</p>
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

  function formatWorkflowProgressDetails(status, numSuccessfulTasks, workflowKey = null, startedAt = null) {
      // Converts raw workflow status updates into user-facing loading text.
    const taskPrefix = Number.isFinite(numSuccessfulTasks) ? `${numSuccessfulTasks} steps complete — ` : '';
    const resolvedStep = workflowKey
      ? resolveWorkflowStepByTaskCount(workflowKey, numSuccessfulTasks)
      : null;
    const configuredLabel = resolvedStep?.step?.progressLabel || null;
    if (configuredLabel) {
      return `${taskPrefix}${configuredLabel}.`;
    }

    const normalizedStatus = typeof status === 'string' && status.trim()
      ? status.trim().replace(/_/g, ' ').toLowerCase()
      : 'processing';
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;
    const remainingMs = Math.max(0, WORKFLOW_RESPONSE_MAX_WAIT_MS - elapsedMs);
    return `${taskPrefix}Workflow is ${normalizedStatus}. Waiting up to ${formatDuration(remainingMs)}.`;
  }

  function createWorkflowCountdown(element, label, progressLabel, workflowKey = null) {
    const startedAt = Date.now();
    let lastStatus = 'processing';
    let lastTasks = null;
    let timerId = null;

    const tick = () => updateCheckLoadingText(
      element, label,
      formatWorkflowProgressDetails(lastStatus, lastTasks, workflowKey, startedAt),
      progressLabel
    );

    timerId = setInterval(tick, 1000);

    return {
      startedAt,
      onProgress(status, tasks) {
        if (status) lastStatus = status;
        if (Number.isFinite(tasks)) lastTasks = tasks;
        tick();
      },
      stop() {
        if (timerId) { clearInterval(timerId); timerId = null; }
      }
    };
  }

  async function runSingleAttempt(task, operationName = 'workflow') {
      // Executes the task once and lets the underlying Rewst client handle the long poll.
    const startedAt = Date.now();

    try {
      const result = await task();
      const elapsedMs = Date.now() - startedAt;
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

    const findFieldValueDeep = (root, targetFieldNames) => {
      if (!root || typeof root !== 'object') return null;

      const visited = new Set();
      const stack = [root];

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || typeof current !== 'object') continue;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const fieldName of targetFieldNames) {
          if (Object.prototype.hasOwnProperty.call(current, fieldName)) {
            const value = current[fieldName];
            if (value !== undefined && value !== null) {
              return value;
            }
          }
        }

        if (Array.isArray(current)) {
          current.forEach((item) => {
            if (item && typeof item === 'object') {
              stack.push(item);
            }
          });
        } else {
          Object.values(current).forEach((value) => {
            if (value && typeof value === 'object') {
              stack.push(value);
            }
          });
        }
      }

      return null;
    };

    for (const candidate of candidates) {
      for (const fieldName of fieldNames) {
        if (Object.prototype.hasOwnProperty.call(candidate, fieldName)) {
          const value = candidate[fieldName];
          if (value !== undefined && value !== null) {
            return value;
          }
        }
      }

      const nestedMatch = findFieldValueDeep(candidate, fieldNames);
      if (nestedMatch !== null && nestedMatch !== undefined) {
        return nestedMatch;
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
        const EMAIL_KEY_HINTS = [
          'username',
          'user_name',
          'user_email',
          'userEmail',
          'email',
          'mail',
          'upn',
          'user_principal_name',
          'userPrincipalName',
          'principalName'
        ];

        const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const findEmailInValue = (value, depth = 0) => {
          if (depth > 4 || value === null || value === undefined) return null;

          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (EMAIL_PATTERN.test(trimmed)) {
              return trimmed;
            }
            return null;
          }

          if (Array.isArray(value)) {
            for (const item of value) {
              const found = findEmailInValue(item, depth + 1);
              if (found) return found;
            }
            return null;
          }

          if (typeof value === 'object') {
            for (const key of EMAIL_KEY_HINTS) {
              if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findEmailInValue(value[key], depth + 1);
                if (found) return found;
              }
            }

            for (const nestedValue of Object.values(value)) {
              const found = findEmailInValue(nestedValue, depth + 1);
              if (found) return found;
            }
          }

          return null;
        };

        const extractUserEmail = (result) => {
            const candidates = [
              getFirstFieldValue(result, ['username']),
              getFirstFieldValue(result, ['user_name', 'upn']),
              getFirstFieldValue(result, ['user_email', 'userEmail']),
              getFirstFieldValue(result, ['email', 'mail']),
              getFirstFieldValue(result, ['user_principal_name', 'userPrincipalName', 'principalName']),
              result
            ];

          for (const candidate of candidates) {
            const found = findEmailInValue(candidate);
            if (found) {
              return found;
            }
          }

          return null;
        };

        const runEmailLookupAttempt = async (operationName, loadingStatus = 'Communicating with Rewst') => {
          const cd = createWorkflowCountdown(emailVerificationCheckItem, 'Email verification', loadingStatus);
          try {
            return await runSingleAttempt(
              () => rewst.runWorkflowSmart(getWorkflowId('USER_EMAIL'), {}, {
                onProgress: (status, tasks) => cd.onProgress(status, tasks)
              }),
              operationName
            );
          } finally {
            cd.stop();
          }
        };

        let attemptResult = await runEmailLookupAttempt('Email verification lookup');
        let email = extractUserEmail(attemptResult.result);

        if (attemptResult.ok && !email) {
          const refreshedResult = await refreshExecutionOutput(
            attemptResult.result,
            'Email verification lookup'
          );
          if (refreshedResult) {
            email = extractUserEmail(refreshedResult);
          }
        }

        // Some runs report success before the email payload is fully materialized.
        if (attemptResult.ok && !email) {
          await sleep(1200);
          attemptResult = await runEmailLookupAttempt('Email verification lookup retry', 'Finalizing account lookup');
          email = extractUserEmail(attemptResult.result);
        }

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
      await runCwmConfigurationCheck({ continuePipeline: true });
    }
  }

  async function runCaNameCheck() {
      // Fetches the ca_name org variable from Rewst. This is a company-level setting
      // that must be configured before VPN certificates can work.
    const element = companyCheckElements['ca_name'];
    setCheckLoading(element, 'CA Name', 'Loading company settings...');
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
    setCheckLoading(element, 'AD Domain', 'Loading company settings...');
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

  function getCompanyCheckById(checkId) {
    return companyChecks.find((check) => check.id === checkId) || null;
  }

  function getCompanyCheckRetryHandler(checkId) {
    if (checkId === 'ca_name') return runCaNameCheck;
    if (checkId === 'ad_domain') return runAdDomainCheck;
    if (checkId === 'vpn_adapter_name') return runVpnAdapterNameCheck;
    if (checkId === 'vpn_server_address') return runVpnServerAddressCheck;
    if (checkId === 'vpn_remote_networks') return runVpnRemoteNetworksCheck;
    if (checkId === 'vpn_nameservers') return runVpnNameserversCheck;
    if (checkId === 'vpn_remote_domain') return runVpnRemoteDomainCheck;
    return null;
  }

  async function runCompanyOrgVariableCheck(checkId) {
    const check = getCompanyCheckById(checkId);
    if (!check) return;

    const element = companyCheckElements[check.id];
    setCheckLoading(element, check.label, 'Loading company settings...');
    checkResultDetails[check.id] = '';

    try {
      const attemptResult = await runSingleAttempt(
        () => rewst.getOrgVariable(check.variableKey),
        `Company prerequisite: ${check.label}`
      );

      if (attemptResult.ok && attemptResult.result) {
        const value = attemptResult.result;
        checkStates[check.id] = true;
        checkResultDetails[check.id] = `Data: ${value}`;
        renderCheckResult(element, true, check.label, checkResultDetails[check.id]);
      } else {
        checkStates[check.id] = false;
        checkResultDetails[check.id] = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : `No ${check.label} returned`;
        clearCachedPrereqs();
        renderCheckResult(
          element,
          false,
          check.label,
          checkResultDetails[check.id],
          getCompanyCheckRetryHandler(check.id)
        );
      }
    } finally {
      updateButtonState();
    }
  }

  async function runVpnAdapterNameCheck() {
    await runCompanyOrgVariableCheck('vpn_adapter_name');
  }

  async function runVpnServerAddressCheck() {
    await runCompanyOrgVariableCheck('vpn_server_address');
  }

  async function runVpnRemoteNetworksCheck() {
    await runCompanyOrgVariableCheck('vpn_remote_networks');
  }

  async function runVpnNameserversCheck() {
    await runCompanyOrgVariableCheck('vpn_nameservers');
  }

  async function runVpnRemoteDomainCheck() {
    await runCompanyOrgVariableCheck('vpn_remote_domain');
  }

  async function runCwmConfigurationCheck(options = {}) {
    const continuePipeline = options.continuePipeline === true;
      // Asks a Rewst workflow for the user's CWM (ConnectWise Manage) device configurations.
      // If exactly one is found, it's selected automatically. If multiple are found, the first is used.
      // The selectedConfig is stored globally for downstream checks (computer online, cert check).
    setCheckLoading(cwmCheckItem, 'CWM Configuration', 'Looking up your device record...');
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

      const cwmCountdown = createWorkflowCountdown(cwmCheckItem, 'CWM Configuration', 'Communicating with CWM');
      const attemptResult = await runSingleAttempt(
        () => rewst.runWorkflowSmart(getWorkflowId('CWM_CONFIGURATIONS'), {
          user_principal_name: userEmail
        }, {
          onProgress: (status, tasks) => cwmCountdown.onProgress(status, tasks)
        }),
        'User prerequisite: CWM Configuration'
      );
      cwmCountdown.stop();

      const cwmResolution = attemptResult.ok
        ? await resolveCwmConfigurations(attemptResult.result)
        : { rawConfigs: [], validConfigs: [], usedFreshExecutionRead: false };
      const rawConfigs = cwmResolution.rawConfigs;
      const validConfigs = cwmResolution.validConfigs;
      const candidateObjects = buildResultDataCandidates(attemptResult.result);
      const executionId = getWorkflowExecutionId(attemptResult.result) || 'n/a';
      const candidatePreview = candidateObjects
        .slice(0, 4)
        .map((candidate, index) => {
          const keys = Object.keys(candidate);
          const previewKeys = keys.slice(0, 8).join(', ');
          const suffix = keys.length > 8 ? ', ...' : '';
          return `#${index + 1}: [${previewKeys}${suffix}]`;
        })
        .join(' | ');

      if (rawConfigs.length > 0 && validConfigs.length === 0) {
        const firstRawConfig = rawConfigs[0];
        const missingFields = ['name', 'id', 'deviceIdentifier'].filter(
          (field) => !firstRawConfig || firstRawConfig[field] === undefined || firstRawConfig[field] === null || firstRawConfig[field] === ''
        );

        debugWarn(
          `[Workflow] User prerequisite: CWM Configuration rejected all configs ` +
          `(executionId=${executionId}, firstConfigMissing=${missingFields.join(', ') || 'none'})`,
          {
            firstConfigKeys: firstRawConfig && typeof firstRawConfig === 'object'
              ? Object.keys(firstRawConfig)
              : [],
            candidatePreview
          }
        );
      }

      if (rawConfigs.length === 0 && attemptResult.ok) {
        debugWarn(
          `[Workflow] User prerequisite: CWM Configuration returned zero configs despite successful workflow ` +
          `(executionId=${executionId})`,
          { candidatePreview }
        );
      }

      if (!attemptResult.ok || validConfigs.length === 0) {
        checkStates.cwm_config = false;
        checkResultDetails.cwm_config = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : 'Workflow completed without returning any valid configurations';
        renderCheckResult(
          cwmCheckItem,
          false,
          'CWM Configuration',
          checkResultDetails.cwm_config,
          () => runCwmConfigurationCheck({ continuePipeline: true })
        );
      } else if (validConfigs.length === 1) {
        selectedConfig = validConfigs[0];
        window.selectedConfig = selectedConfig;
        try {
          sessionStorage.setItem('selectedConfig', JSON.stringify(selectedConfig));
        } catch (e) {
          // Ignore storage errors.
        }
        checkStates.cwm_config = true;
        checkResultDetails.cwm_config = cwmResolution.usedFreshExecutionRead
          ? `Selected: ${selectedConfig.name} (refreshed execution output)`
          : `Selected: ${selectedConfig.name}`;
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
        checkResultDetails.cwm_config = cwmResolution.usedFreshExecutionRead
          ? `Multiple found, selected: ${selectedConfig.name} (refreshed execution output)`
          : `Multiple found, selected: ${selectedConfig.name}`;
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
      renderCheckResult(
        cwmCheckItem,
        false,
        'CWM Configuration',
        checkResultDetails.cwm_config,
        () => runCwmConfigurationCheck({ continuePipeline: true })
      );
    } finally {
      updateButtonState();
    }

    if (continuePipeline && checkStates.cwm_config) {
      await runComputerOnlineCheck();
    }
  }

  async function runComputerOnlineCheck() {
      // Polls a Rewst workflow to see if the target computer (identified by its CWM device ID)
      // is currently online. Auto-retries every 5 seconds for up to 60 seconds before giving up
      // and presenting the manual re-check option. On success, kicks off the computer prereq checks.
    const RETRY_INTERVAL_MS = 5000;
    const MAX_RETRY_DURATION_MS = 60000;
    const startTime = Date.now();
    let attempt = 0;
    let succeeded = false;
    let lastErrorMessage = '';
    let lastRetryReason = 'none';

    setCheckLoading(
      computerOnlineCheckItem,
      'Computer Online',
      'Checking if your PC is reachable...',
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

      while (true) {
        attempt++;
        const elapsedAtStart = Date.now() - startTime;

        if (attempt > 1) {
          const timeLeftMs = Math.max(0, MAX_RETRY_DURATION_MS - elapsedAtStart);
          const retryMessage = lastRetryReason === 'none'
            ? `No data returned — retrying (attempt ${attempt}, ${formatDuration(timeLeftMs)} remaining)`
            : `Computer appears offline — retrying (attempt ${attempt}, ${formatDuration(timeLeftMs)} remaining)`;
          updateCheckLoadingText(
            computerOnlineCheckItem,
            'Computer Online',
            retryMessage,
            'Waiting for computer to come online'
          );
        }

        const onlineProgressLabel = attempt > 1 ? `Attempt ${attempt} — checking online status` : 'Communicating with your PC';
        const onlineCountdown = createWorkflowCountdown(computerOnlineCheckItem, 'Computer Online', onlineProgressLabel);
        const attemptResult = await runSingleAttempt(
          () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_ONLINE'), {
            cwa_computer_id: selectedConfig.deviceIdentifier
          }, {
            onProgress: (status, tasks) => onlineCountdown.onProgress(status, tasks)
          }),
          'User prerequisite: Computer Online'
        );
        onlineCountdown.stop();

        let resolvedOnlineResult = attemptResult.result;
        let onlineField = getBooleanFieldValue(
          resolvedOnlineResult,
          ['online', 'is_online', 'computer_online', 'isOnline']
        );

        if (attemptResult.ok && onlineField.parsed !== true) {
          const refreshedResult = await refreshExecutionOutput(
            attemptResult.result,
            'User prerequisite: Computer Online'
          );
          if (refreshedResult) {
            resolvedOnlineResult = refreshedResult;
            onlineField = getBooleanFieldValue(
              resolvedOnlineResult,
              ['online', 'is_online', 'computer_online', 'isOnline']
            );
          }
        }

        const computerOnlineExecutionId = getWorkflowExecutionId(attemptResult.result) || 'n/a';
        const onlineCandidateObjects = buildResultDataCandidates(resolvedOnlineResult);
        const onlineCandidatePreview = onlineCandidateObjects
          .slice(0, 4)
          .map((candidate, index) => {
            const keys = Object.keys(candidate);
            const previewKeys = keys.slice(0, 8).join(', ');
            const suffix = keys.length > 8 ? ', ...' : '';
            return `#${index + 1}: [${previewKeys}${suffix}]`;
          })
          .join(' | ');

        if (attemptResult.ok && onlineField.parsed !== true) {
          debugWarn(
            `[Workflow] User prerequisite: Computer Online did not produce a truthy online field ` +
            `(executionId=${computerOnlineExecutionId})`,
            { candidatePreview: onlineCandidatePreview }
          );
        }

        if (attemptResult.ok && onlineField.parsed === true) {
          const onlineValue = onlineField.rawValue;
          checkStates.computer_online = true;
          checkResultDetails.computer_online = 'Your PC is online.';
          renderCheckResult(
            computerOnlineCheckItem,
            true,
            'Computer Online',
            checkResultDetails.computer_online,
            runComputerOnlineCheck
          );
          succeeded = true;
          break;
        }

        // Attempt failed — record error and decide whether to retry
        const isNoneReturn = attemptResult.ok && onlineField.rawValue === null;
        lastRetryReason = isNoneReturn ? 'none' : 'offline';
        lastErrorMessage = attemptResult.error
          ? attemptResult.error.message || 'Workflow execution failed'
          : isNoneReturn
            ? 'No response from device'
            : 'Computer is offline';

        const elapsedAfterAttempt = Date.now() - startTime;
        if (elapsedAfterAttempt >= MAX_RETRY_DURATION_MS) {
          break; // Time exhausted — fall through to final failure render
        }

        await sleep(RETRY_INTERVAL_MS);
      }

      if (!succeeded) {
        const totalElapsed = Date.now() - startTime;
        checkStates.computer_online = false;
        checkResultDetails.computer_online = attempt > 1
          ? `Computer still offline after ${attempt} attempts (${formatDuration(totalElapsed)})`
          : lastErrorMessage || `Computer is still offline after ${formatDuration(totalElapsed)}`;
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
    const vpnConnections = getFirstFieldValue(result, ['VPNConnections', 'vpn_connections', 'vpnConnections']) || data?.VPNConnections || {};

    return {
      certPassed,
      validCertCountRaw,
      validCertCount: Number.isFinite(validCertCount) ? validCertCount : null,
      vpnConnections
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

  async function refreshExecutionOutput(result, operationName, delayMs = 1200) {
      // Some successful workflow runs initially expose empty or incomplete output objects.
      // This does one delayed execution refresh so callers can re-evaluate the final payload.
    const executionId = getWorkflowExecutionId(result);
    if (!executionId) {
      return null;
    }

    try {
      debugWarn(`[Workflow] ${operationName}: refreshing execution output for ${executionId}`);
      await sleep(delayMs);
      return await rewst.getExecutionStatus(executionId, true, true);
    } catch (error) {
      debugWarn(`[Workflow] ${operationName}: refresh read failed for execution ${executionId}`, error);
      return null;
    }
  }

  async function resolveCwmConfigurations(result, operationName = 'User prerequisite: CWM Configuration') {
      // Some successful runs initially expose empty output objects.
      // If no configs are visible, do one direct execution refresh before failing.
    const getRawConfigs = (inputResult) => {
      const rawValue = getFirstFieldValue(inputResult, ['cwm_configurations', 'cwmConfigurations', 'configurations']);
      if (Array.isArray(rawValue)) {
        return rawValue;
      }

      if (rawValue && typeof rawValue === 'object') {
        return Object.values(rawValue);
      }

      return [];
    };

    const getValidConfigs = (configs) => configs.filter(config =>
      config && typeof config === 'object' && config.name && config.id && config.deviceIdentifier
    );

    const initialRawConfigs = getRawConfigs(result);
    const initialValidConfigs = getValidConfigs(initialRawConfigs);
    if (initialValidConfigs.length > 0) {
      return {
        rawConfigs: initialRawConfigs,
        validConfigs: initialValidConfigs,
        usedFreshExecutionRead: false
      };
    }

    const refreshedResult = await refreshExecutionOutput(result, `${operationName}: zero configs visible`);
    if (!refreshedResult) {
      return {
        rawConfigs: initialRawConfigs,
        validConfigs: initialValidConfigs,
        usedFreshExecutionRead: false
      };
    }

    const refreshedRawConfigs = getRawConfigs(refreshedResult);
    const refreshedValidConfigs = getValidConfigs(refreshedRawConfigs);
    return {
      rawConfigs: refreshedRawConfigs,
      validConfigs: refreshedValidConfigs,
      usedFreshExecutionRead: true
    };
  }

  async function resolveComputerPrereqEvaluation(result, operationName = 'Computer prerequisite checks') {
      // Some runs finish but initial output reads can be stale/missing.
      // If ValidCertCount is missing, do one silent refresh by execution ID.
    const initialEvaluation = evaluateComputerPrereqs(result);
    if (initialEvaluation.validCertCount !== null) {
      initialEvaluation.resolvedResult = result;
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
        refreshedEvaluation.resolvedResult = refreshedResult;
        return refreshedEvaluation;
      }
    } catch (error) {
      debugWarn(`[Workflow] ${operationName}: refresh read failed for execution ${executionId}`, error);
    }

    initialEvaluation.resolvedResult = result;
    return initialEvaluation;
  }

  function clearComputerPrereqStateAndRenderBlocked() {
      // Resets the computer check card to "pending" when the Computer Online check hasn't passed yet.
    checkStates.valid_machine_cert_installed = false;
    checkResultDetails.valid_machine_cert_installed = 'Waiting for Computer Online to pass';
    clearVpnSetupSnapshot();

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
      ? `Certificate found (count: ${evaluation.validCertCountRaw})`
      : 'No valid machine certificate found.';

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
      'Checking your device. This may take a moment...',
      'Communicating with your PC'
    );
    checkResultDetails.valid_machine_cert_installed = '';

    if (!selectedConfig || !selectedConfig.deviceIdentifier) {
      checkStates.valid_machine_cert_installed = false;
      checkResultDetails.valid_machine_cert_installed = 'Missing CWA ID from selected configuration';
      clearVpnSetupSnapshot();

      setCheckPending(
        validMachineCertCheckItem,
        'Valid machine certificate installed',
        checkResultDetails.valid_machine_cert_installed
      );
      clearCachedPrereqs();
      updateButtonState();
      return;
    }

    const MAX_NONE_RETRIES = 2;
    let certAttempt = 0;
    let lastAttemptResult = null;
    let evaluation = null;

    while (certAttempt <= MAX_NONE_RETRIES) {
      certAttempt++;

      if (certAttempt > 1) {
        updateCheckLoadingText(
          validMachineCertCheckItem,
          'Valid machine certificate installed',
          `No data returned — retrying (attempt ${certAttempt})`,
          'Communicating with your PC'
        );
        await sleep(2000);
      }

      const certCountdown = createWorkflowCountdown(validMachineCertCheckItem, 'Valid machine certificate installed', 'Communicating with your PC', 'COMPUTER_PREREQUISITES');
      lastAttemptResult = await runSingleAttempt(
        () => rewst.runWorkflowSmart(getWorkflowId('COMPUTER_PREREQUISITES'), { in_cwa_id: selectedConfig.deviceIdentifier }, {
          onProgress: (status, tasks) => certCountdown.onProgress(status, tasks)
        }),
        'Computer prerequisite checks'
      );
      certCountdown.stop();

      if (lastAttemptResult.error && !lastAttemptResult.result) break;

      evaluation = await resolveComputerPrereqEvaluation(lastAttemptResult.result);

      // validCertCount === null means the workflow returned no data — retry if attempts remain.
      // Any real value (0 included) is authoritative: 0 triggers remediation, >=1 passes.
      if (evaluation.validCertCount !== null || !lastAttemptResult.ok) break;
    }

    if (lastAttemptResult.error && !lastAttemptResult.result) {
      const errorDetails = lastAttemptResult.error.message || 'Workflow execution failed';
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
      clearVpnSetupSnapshot();
      updateButtonState();
      return;
    }

    persistVpnSetupSnapshot(
      evaluation.vpnConnections,
      'Adapter status updated from computer prerequisites check.',
      evaluation.resolvedResult || lastAttemptResult.result
    );
    renderComputerPrereqResults(evaluation, !lastAttemptResult.ok ? { attempts: certAttempt } : null);
    if (!lastAttemptResult.ok) clearCachedPrereqs();
    updateButtonState();
  }

  // ---- Run workflow and check results ----
  (async () => {
      // This is where everything actually kicks off. All checks run in sequence because each
      // step depends on the one before it (company → user email → CWM config → computer).
    if (typeof window.AppUI?.setRefreshButtonBusy === 'function') {
      window.AppUI.setRefreshButtonBusy(true);
    }

    try {
    companyChecks.forEach((check, index) => {
      const pendingDetail = index === 0
        ? 'Queued to start.'
        : `Waiting for ${companyChecks[index - 1].label} to complete.`;
      setCheckPending(companyCheckElements[check.id], check.label, pendingDetail);
    });
    setCheckPending(emailVerificationCheckItem, 'Email verification', 'Waiting for company checks to complete.');
    setCheckPending(cwmCheckItem, 'CWM Configuration', 'Waiting for Email verification to pass.');
    setCheckPending(computerOnlineCheckItem, 'Computer Online', 'Waiting for CWM Configuration to complete.');
    setCheckPending(validMachineCertCheckItem, 'Valid machine certificate installed', 'Waiting for Computer Online to pass.');  

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

    // Start user email lookup only when we are running a fresh pipeline.
    startUserEmailPrefetch();

    // Company checks first
    await runCaNameCheck();
    await runAdDomainCheck();
    await runVpnAdapterNameCheck();
    await runVpnServerAddressCheck();
    await runVpnRemoteNetworksCheck();
    await runVpnNameserversCheck();
    await runVpnRemoteDomainCheck();

    // User checks second
    await runEmailVerificationCheck();
    await runCwmConfigurationCheck();

    // Computer checks last — Computer Online must pass before the cert check runs.
    await runComputerOnlineCheck();
    } finally {
      if (typeof window.AppUI?.setRefreshButtonBusy === 'function') {
        window.AppUI.setRefreshButtonBusy(false);
      }
    }
  })();
}
