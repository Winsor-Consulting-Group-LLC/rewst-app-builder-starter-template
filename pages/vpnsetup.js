// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';
  const VPN_SETUP_CACHE_KEY = 'vpnSetupChecksCacheV1';
  const SELECTED_CONFIG_KEY = 'selectedConfig';
  const VPN_VARIABLE_DEFS = [
    { key: 'vpn_adapter_name', label: 'VPN Adapter Name' },
    { key: 'vpn_server_address', label: 'VPN Server Address' },
    { key: 'vpn_remote_domain', label: 'VPN Remote Domain' },
    { key: 'vpn_remote_networks', label: 'VPN Remote Networks' },
    { key: 'vpn_nameservers', label: 'VPN Nameservers' }
  ];

  const WORKFLOW_VALUE_ALIASES = {
    vpn_adapter_name: ['vpn_adapter_name', 'vpnAdapterName', 'VPNAdapterName', 'adapter_name', 'adapterName', 'AdapterName'],
    vpn_server_address: ['vpn_server_address', 'vpnServerAddress', 'VPNServerAddress', 'server_address', 'serverAddress', 'RemoteAddress', 'remote_address'],
    vpn_remote_networks: ['vpn_remote_networks', 'vpnRemoteNetworks', 'VPNRemoteNetworks', 'remote_networks', 'remoteNetworks'],
    vpn_nameservers: ['vpn_nameservers', 'vpnNameservers', 'VPNNameservers', 'dns_entries', 'dnsEntries', 'name_servers', 'nameServers'],
    vpn_remote_domain: ['vpn_remote_domain', 'vpnRemoteDomain', 'VPNRemoteDomain', 'remote_domain', 'remoteDomain']
  };

  const state = {
    statusType: 'pending',
    statusText: 'Waiting for adapter status check.',
    statusLabel: 'Unknown',
    vpnConnections: null,
    desiredVpnConfig: {},
    observedVpnConfig: {},
    inFlight: false,
    activeAction: null,
    lastUpdatedAt: null
  };

  function getWorkflowId(key) {
    const workflowIds = window.WORKFLOW_IDS || {};
    const workflowId = workflowIds[key];
    if (!workflowId) {
      throw new Error(`Missing workflow ID for ${key}. Set it in src/workflow-ids.local.js`);
    }
    return workflowId;
  }

  function getStoredJson(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      debugWarn(`Failed to parse session key ${key}:`, error);
      return null;
    }
  }

  function setStoredJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      debugWarn(`Failed to persist session key ${key}:`, error);
    }
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

  function isValueEmpty(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  function formatVpnConnections(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).join(', ');
    }
    return String(value || 'None');
  }

  function formatValueForDisplay(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : 'N/A';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return 'N/A';
      return value.map((item) => formatValueForDisplay(item)).join(', ');
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return 'N/A';
      return entries.map(([k, v]) => `${k}: ${formatValueForDisplay(v)}`).join(', ');
    }
    return 'N/A';
  }

  function parseOrgVariableDetailText(detailText) {
    if (typeof detailText !== 'string' || !detailText.trim()) return null;
    const match = detailText.match(/^Data:\s*(.*)$/i);
    if (!match) return null;
    const value = match[1] || '';
    const trimmed = value.trim();
    return trimmed || null;
  }

  function getDesiredConfigFromPrereqCache() {
    const cache = getStoredJson(PREREQS_CACHE_KEY);
    const details = cache?.checkResultDetails || {};
    const desired = {};

    VPN_VARIABLE_DEFS.forEach((def) => {
      const parsed = parseOrgVariableDetailText(details[def.key]);
      desired[def.key] = parsed || 'N/A';
    });

    return desired;
  }

  async function refreshDesiredConfigFromOrgVariables() {
    const cachedDesired = getDesiredConfigFromPrereqCache();
    state.desiredVpnConfig = cachedDesired;
    render();

    const results = await Promise.all(VPN_VARIABLE_DEFS.map(async (def) => {
      try {
        const value = await rewst.getOrgVariable(def.key);
        return { key: def.key, value, ok: true };
      } catch (error) {
        return { key: def.key, value: null, ok: false };
      }
    }));

    const nextDesired = { ...cachedDesired };
    results.forEach((entry) => {
      if (entry && entry.key && entry.ok) {
        nextDesired[entry.key] = formatValueForDisplay(entry.value);
      }
    });
    state.desiredVpnConfig = nextDesired;
    render();
  }

  function getObservedConfigFromWorkflowResult(result, vpnConnections) {
    const observed = {};

    VPN_VARIABLE_DEFS.forEach((def) => {
      const rawValue = getFirstFieldValue(result, WORKFLOW_VALUE_ALIASES[def.key] || [def.key]);
      observed[def.key] = formatValueForDisplay(rawValue);
    });

    if (observed.vpn_adapter_name === 'N/A' && !isValueEmpty(vpnConnections)) {
      observed.vpn_adapter_name = formatVpnConnections(vpnConnections);
    }

    return observed;
  }

  const CIDR_LIST_KEYS = new Set(['vpn_remote_networks', 'vpn_nameservers']);

  function formatCidrList(rawValue) {
    let items = null;

    if (Array.isArray(rawValue)) {
      items = rawValue;
    } else if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed || trimmed === 'N/A') return null;
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      } catch (_) {
        // fallback: comma-separated
        items = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!items || items.length === 0) return null;
    return items
      .map((item) => `<span class="vpnsetup-subnet-chip">${String(item).trim()}</span>`)
      .join('');
  }

  function renderConfigCellContent(key, rawValue) {
    if (CIDR_LIST_KEYS.has(key)) {
      const chips = formatCidrList(rawValue);
      if (chips) {
        return `<span class="vpnsetup-subnet-list">${chips}</span>`;
      }
    }
    const display = (rawValue === null || rawValue === undefined || rawValue === '') ? 'N/A' : String(rawValue);
    return `<span>${display}</span>`;
  }

  function getObservedConfigRowsHtml() {
    const rows = VPN_VARIABLE_DEFS.map((def) => {
      const desiredValue = state.desiredVpnConfig?.[def.key] ?? 'N/A';
      const observedValue = state.observedVpnConfig?.[def.key] ?? null;
      const observedDisplay = observedValue === null || observedValue === undefined ? 'N/A' : observedValue;

      const isMatch = desiredValue !== 'N/A' && observedDisplay !== 'N/A' && desiredValue === observedDisplay;
      const reportedClass = isMatch ? 'vpnsetup-config-cell-reported is-match' : 'vpnsetup-config-cell-reported is-mismatch';

      return `
        <tr class="vpnsetup-config-row">
          <td class="vpnsetup-config-cell-label">${def.label}</td>
          <td class="vpnsetup-config-cell-desired">${renderConfigCellContent(def.key, desiredValue)}</td>
          <td class="${reportedClass}">${renderConfigCellContent(def.key, observedDisplay)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="vpnsetup-config-table" aria-label="VPN configuration comparison">
        <thead>
          <tr>
            <th class="vpnsetup-config-th vpnsetup-config-th-label"></th>
            <th class="vpnsetup-config-th vpnsetup-config-th-desired">
              <span class="material-icons">check_circle_outline</span> Desired
            </th>
            <th class="vpnsetup-config-th vpnsetup-config-th-reported">
              <span class="material-icons">computer</span> Reported
            </th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function getSelectedComputerId() {
    if (window.selectedConfig?.deviceIdentifier) {
      return window.selectedConfig.deviceIdentifier;
    }

    const cachedConfig = getStoredJson(SELECTED_CONFIG_KEY);
    if (cachedConfig?.deviceIdentifier) {
      return cachedConfig.deviceIdentifier;
    }

    return null;
  }

  function setAdapterStateFromConnections(vpnConnections, statusText = null) {
    const installed = !isValueEmpty(vpnConnections);
    state.vpnConnections = vpnConnections;
    state.statusType = installed ? 'installed' : 'missing';
    state.statusLabel = installed ? 'Installed' : 'Not installed';
    state.statusText = statusText || (installed
      ? `Detected adapter connection(s): ${formatVpnConnections(vpnConnections)}`
      : 'No VPN adapter connections were reported for this computer.');
  }

  function setBusyState(action, statusOverride = null) {
    state.inFlight = true;
    state.activeAction = action;
    state.statusType = 'running';
    state.statusLabel = 'Running';
    state.statusText = statusOverride || (action === 'check'
      ? 'Running adapter check workflow...'
      : `Submitting VPN adapter ${action} command...`);
  }

  function updateStatusTextInPlace(nextText) {
    const statusTextElement = document.getElementById('vpnsetup-status-text');
    if (statusTextElement) {
      statusTextElement.textContent = nextText;
    }
  }

  function getStatusCardClass() {
    if (state.statusType === 'installed') return 'card card-accent-teal vpnsetup-adapter-card';
    if (state.statusType === 'missing') return 'card card-accent-error vpnsetup-adapter-card';
    return 'card card-accent-fandango vpnsetup-adapter-card';
  }

  function getStatusIconClass() {
    if (state.statusType === 'installed') return 'is-passed';
    if (state.statusType === 'missing') return 'is-failed';
    return 'is-running';
  }

  function getStatusIconName() {
    if (state.statusType === 'installed') return 'check_circle';
    if (state.statusType === 'missing') return 'cancel';
    return 'sync';
  }

  function getCachedAdapterSnapshot() {
    const snapshot = getStoredJson(VPN_SETUP_CACHE_KEY);
    if (!snapshot) return null;

    // Prefer same-device snapshots when available.
    const computerId = getSelectedComputerId();
    if (computerId && snapshot.computerId && snapshot.computerId !== computerId) {
      return null;
    }

    return snapshot;
  }

  function hasCompletePrereqsCache() {
    const cache = getStoredJson(PREREQS_CACHE_KEY);
    const states = cache?.checkStates;
    if (!states) return false;

    const requiredKeys = [
      'ca_name',
      'ad_domain',
      'vpn_adapter_name',
      'vpn_server_address',
      'vpn_remote_networks',
      'vpn_nameservers',
      'vpn_remote_domain',
      'email_verification',
      'cwm_config',
      'computer_online',
      'valid_machine_cert_installed'
    ];

    return requiredKeys.every((key) => states[key] === true);
  }

  function applyCachedSnapshot() {
    const snapshot = getCachedAdapterSnapshot();
    if (!snapshot) {
      state.statusType = 'pending';
      state.statusLabel = 'Unknown';
      state.statusText = 'No cached adapter data found yet. Click Check to fetch live status.';
      return false;
    }

    setAdapterStateFromConnections(snapshot.vpnConnections, snapshot.statusText || null);
    state.observedVpnConfig = snapshot.observedVpnConfig || {};
    state.desiredVpnConfig = snapshot.desiredVpnConfig || getDesiredConfigFromPrereqCache();
    state.lastUpdatedAt = snapshot.lastUpdatedAt || null;
    return true;
  }

  async function refreshAdapterStatusFromPrereq(showSuccessToast = false, options = {}) {
    if (state.inFlight) return;

    const computerId = getSelectedComputerId();
    if (!computerId) {
      state.statusType = 'missing';
      state.statusLabel = 'Not installed';
      state.statusText = 'Unable to determine computer ID from prerequisite selection. Re-run prerequisites first.';
      if (!options.silentOnMissingComputer) {
        RewstDOM.showError('Missing computer ID. Re-run prerequisites to select a computer.');
      }
      render();
      return;
    }

    const checkIntroText = options.autoTriggered
      ? 'Auto-refreshing adapter status from your saved prerequisites. This usually takes a few moments.'
      : null;

    setBusyState('check', checkIntroText);
    render();

    try {
      const result = await rewst.runWorkflowSmart(getWorkflowId('COMPUTER_PREREQUISITES'), {
        in_cwa_id: computerId
      }, {
        onProgress: (status, numSuccessfulTasks) => {
          const normalizedStatus = typeof status === 'string' && status.trim()
            ? status.trim().replace(/_/g, ' ').toLowerCase()
            : 'processing';
          const taskSuffix = Number.isFinite(numSuccessfulTasks) ? ` Successful tasks: ${numSuccessfulTasks}.` : '';
          state.statusText = `Workflow is ${normalizedStatus}.${taskSuffix}`;
          updateStatusTextInPlace(state.statusText);
        }
      });

      let resolvedResult = result;
      let vpnConnections = getFirstFieldValue(resolvedResult, ['VPNConnections', 'vpn_connections', 'vpnConnections']) || {};

      if ((!vpnConnections || Object.keys(vpnConnections).length === 0) && typeof refreshExecutionOutput === 'function') {
        const refreshedResult = await refreshExecutionOutput(result, 'VPN adapter status refresh');
        if (refreshedResult) {
          resolvedResult = refreshedResult;
          vpnConnections = getFirstFieldValue(resolvedResult, ['VPNConnections', 'vpn_connections', 'vpnConnections']) || {};
          state.statusText = 'Adapter status updated from refreshed execution output.';
        }
      }

      setAdapterStateFromConnections(vpnConnections);
      state.observedVpnConfig = getObservedConfigFromWorkflowResult(resolvedResult, vpnConnections);
      state.lastUpdatedAt = new Date().toISOString();

      setStoredJson(VPN_SETUP_CACHE_KEY, {
        computerId,
        vpnConnections,
        desiredVpnConfig: state.desiredVpnConfig,
        observedVpnConfig: state.observedVpnConfig,
        statusText: state.statusText,
        lastUpdatedAt: state.lastUpdatedAt
      });

      if (showSuccessToast) {
        RewstDOM.showSuccess('VPN adapter status refreshed.');
      }
    } catch (error) {
      state.statusType = 'missing';
      state.statusLabel = 'Not installed';
      state.statusText = error?.message || 'Adapter check failed.';
      RewstDOM.showError(state.statusText);
    } finally {
      state.inFlight = false;
      state.activeAction = null;
      render();
    }
  }

  async function runVpnAdapterCommand(command) {
    if (state.inFlight) return;

    const computerId = getSelectedComputerId();
    if (!computerId) {
      RewstDOM.showError('Missing computer ID. Re-run prerequisites to select a computer.');
      return;
    }

    setBusyState(command);
    render();

    try {
      await rewst.runWorkflowSmart(getWorkflowId('VPN_ADAPTER_COMMAND'), {
        in_cwa_id: computerId,
        in_vpn_command: command
      });

      RewstDOM.showSuccess(`VPN adapter ${command} command submitted.`);

      // Automatically re-check adapter status after command completion.
      state.inFlight = false;
      state.activeAction = null;
      await refreshAdapterStatusFromPrereq(false);
    } catch (error) {
      state.inFlight = false;
      state.activeAction = null;
      state.statusType = 'missing';
      state.statusLabel = 'Not installed';
      state.statusText = error?.message || `VPN adapter ${command} command failed.`;
      RewstDOM.showError(state.statusText);
      render();
    }
  }

  function render() {
    const actionDisabled = state.inFlight ? 'disabled' : '';
    const checkButtonLabel = state.activeAction === 'check' ? 'Checking...' : 'Check';
    const installButtonLabel = state.activeAction === 'install' ? 'Installing...' : 'Install';
    const removeButtonLabel = state.activeAction === 'remove' ? 'Removing...' : 'Remove';
    const lastUpdatedText = state.lastUpdatedAt
      ? `Last updated: ${new Date(state.lastUpdatedAt).toLocaleString()}`
      : 'Last updated: not yet checked in this session';

    container.innerHTML = `
      <div class="vpnsetup-functional-shell">
        <section class="card prereq-command-card vpnsetup-command-card">
          <div class="prereq-command-row">
            <div class="prereq-command-left">
              <div class="prereq-command-badge">
                <span class="material-icons">vpn_lock</span>
                <span>VPN Adapter Operations</span>
              </div>
              <h2 class="prereq-command-title">Install, remove, or verify the VPN adapter</h2>
              <p class="prereq-command-copy">
                This page manages the local VPN adapter on your selected computer and reports adapter status from the computer prerequisite workflow.
              </p>
            </div>
            <div class="prereq-command-right">
              <div class="prereq-progress-header">
                <span class="prereq-progress-label">Adapter Status</span>
                <span class="prereq-progress-value">${state.statusLabel}</span>
              </div>
              <p class="prereq-cadence-label">${lastUpdatedText}</p>
            </div>
          </div>
        </section>

        <section class="${getStatusCardClass()}">
          <div class="vpnsetup-adapter-header">
            <div class="prereq-check-icon ${getStatusIconClass()}">
              <span class="material-icons ${state.statusType === 'running' ? 'prereq-icon-spin' : ''}">${getStatusIconName()}</span>
            </div>
            <div class="vpnsetup-adapter-title-wrap">
              <h3 class="vpnsetup-adapter-title">VPN adapter status</h3>
              <p id="vpnsetup-status-text" class="vpnsetup-adapter-status-text">${state.statusText}</p>
            </div>
            <span class="vpnsetup-adapter-pill is-${state.statusType}">${state.statusLabel}</span>
          </div>

          <div class="vpnsetup-action-row">
            <button id="vpnsetup-install-btn" class="btn-primary" ${actionDisabled}>
              <span class="material-icons">download</span>
              <span>${installButtonLabel}</span>
            </button>
            <button id="vpnsetup-remove-btn" class="btn-secondary" ${actionDisabled}>
              <span class="material-icons">delete</span>
              <span>${removeButtonLabel}</span>
            </button>
            <button id="vpnsetup-check-btn" class="btn-tertiary" ${actionDisabled}>
              <span class="material-icons">refresh</span>
              <span>${checkButtonLabel}</span>
            </button>
          </div>

          <div class="vpnsetup-detail-grid">
            ${getObservedConfigRowsHtml()}
          </div>
        </section>
      </div>
    `;

    const installBtn = document.getElementById('vpnsetup-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', () => runVpnAdapterCommand('install'));
    }

    const removeBtn = document.getElementById('vpnsetup-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => runVpnAdapterCommand('remove'));
    }

    const checkBtn = document.getElementById('vpnsetup-check-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => refreshAdapterStatusFromPrereq(true));
    }
  }

  const loadedFromCache = applyCachedSnapshot();
  refreshDesiredConfigFromOrgVariables().catch((error) => {
    debugWarn('Failed to refresh desired VPN config values from org variables:', error);
  });
  render();

  // Backfill adapter status if prerequisites were restored from cache but VPN snapshot is missing.
  if (!loadedFromCache && hasCompletePrereqsCache()) {
    refreshAdapterStatusFromPrereq(false, {
      silentOnMissingComputer: true,
      autoTriggered: true
    });
  }
}
