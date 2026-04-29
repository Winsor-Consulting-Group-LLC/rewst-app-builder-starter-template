// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  const PREREQS_CACHE_KEY = 'prerequisitesChecksCacheV1';
  const VPN_SETUP_CACHE_KEY = 'vpnSetupChecksCacheV1';
  const SELECTED_CONFIG_KEY = 'selectedConfig';

  const state = {
    statusType: 'pending',
    statusText: 'Waiting for adapter status check.',
    statusLabel: 'Unknown',
    vpnConnections: null,
    inFlight: false,
    activeAction: null,
    lastUpdatedAt: null,
    remoteAddress: '203.0.113.14',
    dnsEntries: '10.0.0.53, 10.0.0.54',
    connectionState: 'Disconnected',
    adapterProfile: 'Winsor Secure Tunnel'
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
    state.connectionState = installed ? 'Connected/Available' : 'Disconnected';
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
          render();
        }
      });

      const vpnConnections = getFirstFieldValue(result, ['VPNConnections', 'vpn_connections', 'vpnConnections']) || {};
      setAdapterStateFromConnections(vpnConnections);
      state.lastUpdatedAt = new Date().toISOString();

      setStoredJson(VPN_SETUP_CACHE_KEY, {
        computerId,
        vpnConnections,
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
              <p class="vpnsetup-adapter-status-text">${state.statusText}</p>
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
            <div class="vpnsetup-detail-row">
              <span class="vpnsetup-detail-label">Remote address</span>
              <span class="vpnsetup-detail-value">${state.remoteAddress}</span>
            </div>
            <div class="vpnsetup-detail-row">
              <span class="vpnsetup-detail-label">DNS entries</span>
              <span class="vpnsetup-detail-value">${state.dnsEntries}</span>
            </div>
            <div class="vpnsetup-detail-row">
              <span class="vpnsetup-detail-label">Connection state</span>
              <span class="vpnsetup-detail-value">${state.connectionState}</span>
            </div>
            <div class="vpnsetup-detail-row">
              <span class="vpnsetup-detail-label">Adapter profile</span>
              <span class="vpnsetup-detail-value">${state.adapterProfile}</span>
            </div>
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
  render();

  // Backfill adapter status if prerequisites were restored from cache but VPN snapshot is missing.
  if (!loadedFromCache && hasCompletePrereqsCache()) {
    refreshAdapterStatusFromPrereq(false, {
      silentOnMissingComputer: true,
      autoTriggered: true
    });
  }
}
