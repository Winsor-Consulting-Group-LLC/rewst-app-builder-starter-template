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
    lastUpdatedAt: null,
    removeConfirmOpen: false,
    removeConfirmCountdown: 0,
    removeConfirmReady: false,
    removeConfirmTimerId: null
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
    const seen = new Set();

    const pushCandidate = (value) => {
      let normalized = value;

      if (typeof normalized === 'string') {
        const trimmed = normalized.trim();
        if (!trimmed) return;
        try {
          normalized = JSON.parse(trimmed);
        } catch (_) {
          return;
        }
      }

      if (!normalized || typeof normalized !== 'object') return;
      if (seen.has(normalized)) return;

      seen.add(normalized);
      candidates.push(normalized);

      // Workflow APIs commonly wrap actual payloads under one of these fields.
      ['output', 'result', 'data', 'payload'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(normalized, key)) {
          pushCandidate(normalized[key]);
        }
      });
    };

    pushCandidate(result);
    pushCandidate(result?.output);
    pushCandidate(result?.execution?.conductor?.output);
    pushCandidate(result?.execution?.output);

    return candidates;
  }

  function getFirstFieldValue(result, fieldNames) {
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

  function getObjectFieldValue(value, fieldNames) {
    if (!value || typeof value !== 'object') return null;

    for (const fieldName of fieldNames) {
      if (Object.prototype.hasOwnProperty.call(value, fieldName)) {
        const fieldValue = value[fieldName];
        if (fieldValue !== undefined && fieldValue !== null) {
          return fieldValue;
        }
      }
    }

    return null;
  }

  function getObservedConfigFromWorkflowResult(result, vpnConnections) {
    const observed = {};
    const vpnConnectionObject = (vpnConnections && typeof vpnConnections === 'object' && !Array.isArray(vpnConnections))
      ? vpnConnections
      : null;

    const vpnConnectionFieldMap = {
      vpn_adapter_name: ['Name'],
      vpn_server_address: ['ServerAddress'],
      vpn_remote_domain: ['DnsSuffix'],
      vpn_remote_networks: ['Routes'],
      vpn_nameservers: ['ServerList']
    };

    VPN_VARIABLE_DEFS.forEach((def) => {
      const connectionValue = getObjectFieldValue(vpnConnectionObject, vpnConnectionFieldMap[def.key] || []);
      const fallbackValue = getFirstFieldValue(result, WORKFLOW_VALUE_ALIASES[def.key] || [def.key]);
      const rawValue = !isValueEmpty(connectionValue) ? connectionValue : fallbackValue;
      observed[def.key] = formatValueForDisplay(rawValue);
    });

    // Override vpn_remote_networks: use VPNRoutes.DestinationPrefix instead of the raw CIM Routes object
    const vpnRoutesData = getFirstFieldValue(result, ['VPNRoutes', 'vpnRoutes']);
    if (!isValueEmpty(vpnRoutesData)) {
      if (Array.isArray(vpnRoutesData)) {
        const prefixes = vpnRoutesData.map((r) => r?.DestinationPrefix).filter(Boolean);
        if (prefixes.length > 0) observed.vpn_remote_networks = formatValueForDisplay(prefixes);
      } else if (vpnRoutesData.DestinationPrefix) {
        observed.vpn_remote_networks = formatValueForDisplay(vpnRoutesData.DestinationPrefix);
      }
    }

    // Override vpn_nameservers: extract from DNSServers filtered to VPN adapter interfaces
    const dnsServersData = getFirstFieldValue(result, ['DNSServers', 'dnsServers']);
    if (!isValueEmpty(dnsServersData) && Array.isArray(dnsServersData)) {
      const vpnNameservers = dnsServersData
        .filter((entry) => entry?.InterfaceAlias && entry.InterfaceAlias.toLowerCase().includes('vpn'))
        .flatMap((entry) => entry?.ServerAddresses || [])
        .filter(Boolean);
      if (vpnNameservers.length > 0) observed.vpn_nameservers = formatValueForDisplay(vpnNameservers);
    }

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

  function parseCompareTokens(value) {
    if (value === null || value === undefined) return [];

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeCompareValue(item))
        .filter(Boolean);
    }

    const normalized = normalizeCompareValue(value);
    if (!normalized || normalized === 'n/a') return [];

    try {
      const parsed = JSON.parse(String(value));
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeCompareValue(item))
          .filter(Boolean);
      }
    } catch (_) {
      // Keep plain-string handling below.
    }

    return normalized
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function isCaseInsensitiveExactMatch(desiredValue, observedValue) {
    const desired = normalizeCompareValue(desiredValue);
    const observed = normalizeCompareValue(observedValue);
    if (!desired || desired === 'n/a' || !observed || observed === 'n/a') return false;
    return desired === observed;
  }

  function isDesiredContainedInObserved(desiredValue, observedValue) {
    const desiredTokens = parseCompareTokens(desiredValue);
    const observed = normalizeCompareValue(observedValue);
    if (desiredTokens.length === 0 || !observed || observed === 'n/a') return false;
    return desiredTokens.every((token) => observed.includes(token));
  }

  function isDesiredListInObservedList(desiredValue, observedValue) {
    const desiredTokens = parseCompareTokens(desiredValue);
    const observedTokens = new Set(parseCompareTokens(observedValue));
    if (desiredTokens.length === 0 || observedTokens.size === 0) return false;
    return desiredTokens.every((token) => observedTokens.has(token));
  }

  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;');
  }

  function getComparisonStateForKey(key, desiredValue, observedValue) {
    if (key === 'vpn_adapter_name' || key === 'vpn_server_address') {
      return {
        status: isCaseInsensitiveExactMatch(desiredValue, observedValue) ? 'match' : 'mismatch',
        warningDetail: ''
      };
    }

    if (key === 'vpn_remote_domain') {
      return {
        status: isDesiredContainedInObserved(desiredValue, observedValue) ? 'match' : 'mismatch',
        warningDetail: ''
      };
    }

    if (key === 'vpn_remote_networks' || key === 'vpn_nameservers') {
      const matches = isDesiredListInObservedList(desiredValue, observedValue);
      return {
        status: matches ? 'match' : 'warning',
        warningDetail: matches
          ? ''
          : 'VPN may connect, but you may experience access issues until this is resolved.'
      };
    }

    return {
      status: isCaseInsensitiveExactMatch(desiredValue, observedValue) ? 'match' : 'mismatch',
      warningDetail: ''
    };
  }

  function getObservedConfigRowsHtml() {
    const reportedConnectionStatus = getCurrentConnectionStatus();
    const statusComparison = normalizeCompareValue(reportedConnectionStatus) === 'connected' ? 'match' : 'mismatch';
    const statusRow = `
      <tr class="vpnsetup-config-row vpnsetup-status-row is-${statusComparison}">
        <td class="vpnsetup-config-cell-label">Connected Status</td>
        <td class="vpnsetup-config-cell-desired"><span>Connected</span></td>
        <td class="vpnsetup-config-cell-reported is-${statusComparison}"><span>${reportedConnectionStatus}</span></td>
      </tr>
    `;

    const rows = VPN_VARIABLE_DEFS.map((def) => {
      const desiredValue = state.desiredVpnConfig?.[def.key] ?? 'N/A';
      const observedValue = state.observedVpnConfig?.[def.key] ?? null;
      const observedDisplay = observedValue === null || observedValue === undefined ? 'N/A' : observedValue;

      const comparison = getComparisonStateForKey(def.key, desiredValue, observedDisplay);
      const reportedClass = `vpnsetup-config-cell-reported is-${comparison.status}`;
      const warningDetail = comparison.warningDetail
        ? `${comparison.warningDetail} Desired: ${desiredValue}. Reported: ${observedDisplay}.`
        : '';
      const warningIcon = comparison.status === 'warning'
        ? `<span class="material-icons vpnsetup-warning-icon" title="${escapeHtmlAttribute(warningDetail)}" aria-label="Warning">warning_amber</span>`
        : '';

      return `
        <tr class="vpnsetup-config-row">
          <td class="vpnsetup-config-cell-label">${def.label}</td>
          <td class="vpnsetup-config-cell-desired">${renderConfigCellContent(def.key, desiredValue)}</td>
          <td class="${reportedClass}">${warningIcon}${renderConfigCellContent(def.key, observedDisplay)}</td>
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
        <tbody>${statusRow}${rows}</tbody>
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

  function normalizeCompareValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
  }

  function getCurrentConnectionStatus(vpnConnections = state.vpnConnections) {
    return formatValueForDisplay(getObjectFieldValue(vpnConnections, ['ConnectionStatus']));
  }

  function isAdapterConnected(vpnConnections = state.vpnConnections) {
    return normalizeCompareValue(getCurrentConnectionStatus(vpnConnections)) === 'connected';
  }

  function evaluateAdapterSuccess(desiredConfig, observedConfig, vpnConnections) {
    const mismatchedLabels = [];

    const adapterMatches = isCaseInsensitiveExactMatch(
      desiredConfig?.vpn_adapter_name ?? 'N/A',
      observedConfig?.vpn_adapter_name ?? 'N/A'
    );
    if (!adapterMatches) mismatchedLabels.push('adapter name');

    const serverMatches = isCaseInsensitiveExactMatch(
      desiredConfig?.vpn_server_address ?? 'N/A',
      observedConfig?.vpn_server_address ?? 'N/A'
    );
    if (!serverMatches) mismatchedLabels.push('server address');

    const remoteDomainMatches = isDesiredContainedInObserved(
      desiredConfig?.vpn_remote_domain ?? 'N/A',
      observedConfig?.vpn_remote_domain ?? 'N/A'
    );
    if (!remoteDomainMatches) mismatchedLabels.push('DNS name');

    const connectionStatus = formatValueForDisplay(getObjectFieldValue(vpnConnections, ['ConnectionStatus']));
    const isConnected = normalizeCompareValue(connectionStatus) === 'connected';

    return {
      isSuccess: mismatchedLabels.length === 0 && isConnected,
      mismatchedLabels,
      connectionStatus
    };
  }

  function setAdapterStateFromConnections(vpnConnections, observedConfig = state.observedVpnConfig, desiredConfig = state.desiredVpnConfig, statusText = null) {
    const installed = !isValueEmpty(vpnConnections);
    state.vpnConnections = vpnConnections;

    if (!installed) {
      state.statusType = 'missing';
      state.statusLabel = 'Not installed';
      state.statusText = statusText || 'No VPN adapter connections were reported for this computer.';
      return;
    }

    const evaluation = evaluateAdapterSuccess(desiredConfig, observedConfig, vpnConnections);

    if (evaluation.isSuccess) {
      state.statusType = 'installed';
      state.statusLabel = 'Installed';
      state.statusText = statusText || 'VPN adapter matches desired name, server address, DNS name, and reports Connected.';
      return;
    }

    state.statusType = 'missing';
    state.statusLabel = 'Needs attention';

    const mismatchText = evaluation.mismatchedLabels.length > 0
      ? `Mismatch: ${evaluation.mismatchedLabels.join(', ')}.`
      : '';
    const connectionText = `ConnectionStatus: ${evaluation.connectionStatus}.`;
    state.statusText = statusText || `VPN adapter was reported but does not meet success criteria. ${mismatchText} ${connectionText}`.trim();
  }

  function setBusyState(action, statusOverride = null) {
    state.inFlight = true;
    state.activeAction = action;
    state.statusType = 'running';
    state.statusLabel = 'Running';
    state.statusText = statusOverride || (action === 'check'
      ? 'Running adapter check workflow...'
      : `Submitting VPN adapter ${action} command...`);
    if (typeof window.AppUI?.setRefreshButtonBusy === 'function') {
      window.AppUI.setRefreshButtonBusy(true);
    }
  }

  function updateStatusTextInPlace(nextText) {
    const statusTextElement = document.getElementById('vpnsetup-status-text');
    if (statusTextElement) {
      statusTextElement.textContent = nextText;
    }
  }

  function clearRemoveConfirmTimer() {
    if (state.removeConfirmTimerId) {
      clearInterval(state.removeConfirmTimerId);
      state.removeConfirmTimerId = null;
    }
  }

  function updateRemoveConfirmDialogInPlace() {
    const countdownTextEl = document.getElementById('vpnsetup-remove-countdown');
    if (countdownTextEl) {
      countdownTextEl.textContent = state.removeConfirmReady
        ? 'Countdown complete. Remove is now enabled.'
        : `Remove will be enabled in ${state.removeConfirmCountdown} second${state.removeConfirmCountdown === 1 ? '' : 's'}...`;
    }

    const confirmBtn = document.getElementById('vpnsetup-remove-confirm-btn');
    if (confirmBtn) {
      const isDisabled = !state.removeConfirmReady;
      confirmBtn.disabled = isDisabled;
      confirmBtn.setAttribute('aria-disabled', String(isDisabled));
    }

    const confirmLabel = document.getElementById('vpnsetup-remove-confirm-label');
    if (confirmLabel) {
      confirmLabel.textContent = state.removeConfirmReady
        ? 'Confirm Remove'
        : `Confirm Remove (${state.removeConfirmCountdown})`;
    }
  }

  function closeRemoveConfirmDialog(returnFocusToRemoveButton = true) {
    if (!state.removeConfirmOpen) return;

    clearRemoveConfirmTimer();
    state.removeConfirmOpen = false;
    state.removeConfirmCountdown = 0;
    state.removeConfirmReady = false;
    render();

    if (returnFocusToRemoveButton) {
      setTimeout(() => {
        const removeBtn = document.getElementById('vpnsetup-remove-btn');
        if (removeBtn) removeBtn.focus();
      }, 0);
    }
  }

  function openRemoveConfirmDialog() {
    if (state.inFlight) return;

    const adapterInstalled = !isValueEmpty(state.vpnConnections);
    if (!adapterInstalled) return;

    clearRemoveConfirmTimer();
    state.removeConfirmOpen = true;
    state.removeConfirmCountdown = 3;
    state.removeConfirmReady = false;
    render();
    updateRemoveConfirmDialogInPlace();

    setTimeout(() => {
      const cancelBtn = document.getElementById('vpnsetup-remove-cancel-btn');
      if (cancelBtn) cancelBtn.focus();
    }, 0);

    state.removeConfirmTimerId = setInterval(() => {
      if (!state.removeConfirmOpen) {
        clearRemoveConfirmTimer();
        return;
      }

      if (state.removeConfirmCountdown > 1) {
        state.removeConfirmCountdown -= 1;
      } else {
        state.removeConfirmCountdown = 0;
        state.removeConfirmReady = true;
        clearRemoveConfirmTimer();
      }

      updateRemoveConfirmDialogInPlace();
    }, 1000);
  }

  async function confirmRemoveAdapter() {
    if (!state.removeConfirmOpen || !state.removeConfirmReady || state.inFlight) return;

    closeRemoveConfirmDialog(false);
    await runVpnAdapterCommand('disconnect');
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

    state.observedVpnConfig = snapshot.observedVpnConfig || {};
    state.desiredVpnConfig = snapshot.desiredVpnConfig || getDesiredConfigFromPrereqCache();
    setAdapterStateFromConnections(snapshot.vpnConnections, state.observedVpnConfig, state.desiredVpnConfig, snapshot.statusText || null);
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

      state.observedVpnConfig = getObservedConfigFromWorkflowResult(resolvedResult, vpnConnections);
      setAdapterStateFromConnections(vpnConnections, state.observedVpnConfig, state.desiredVpnConfig);
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
      if (typeof window.AppUI?.setRefreshButtonBusy === 'function') {
        window.AppUI.setRefreshButtonBusy(false);
      }
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
    const adapterInstalled = !isValueEmpty(state.vpnConnections);
    const adapterConnected = isAdapterConnected();
    const installDisabled = state.inFlight || (adapterInstalled && adapterConnected);
    const removeDisabled = state.inFlight || !adapterInstalled;
    const checkDisabled = state.inFlight;

    const installDisabledAttr = installDisabled ? 'disabled' : '';
    const removeDisabledAttr = removeDisabled ? 'disabled' : '';
    const checkDisabledAttr = checkDisabled ? 'disabled' : '';

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
            <button id="vpnsetup-install-btn" class="btn-primary" ${installDisabledAttr}>
              <span class="material-icons">download</span>
              <span>${installButtonLabel}</span>
            </button>
            <button id="vpnsetup-remove-btn" class="btn-secondary" ${removeDisabledAttr}>
              <span class="material-icons">delete</span>
              <span>${removeButtonLabel}</span>
            </button>
            <button id="vpnsetup-check-btn" class="btn-tertiary" ${checkDisabledAttr}>
              <span class="material-icons">refresh</span>
              <span>${checkButtonLabel}</span>
            </button>
          </div>

          <div class="vpnsetup-detail-grid">
            ${getObservedConfigRowsHtml()}
          </div>
        </section>

        ${state.removeConfirmOpen ? `
          <div id="vpnsetup-remove-modal-overlay" class="vpnsetup-modal-overlay" role="presentation">
            <div
              id="vpnsetup-remove-modal"
              class="vpnsetup-remove-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="vpnsetup-remove-modal-title"
              aria-describedby="vpnsetup-remove-modal-desc vpnsetup-remove-countdown"
              tabindex="-1"
            >
              <div class="vpnsetup-remove-modal-header">
                <span class="material-icons vpnsetup-remove-modal-icon">warning</span>
                <h4 id="vpnsetup-remove-modal-title" class="vpnsetup-remove-modal-title">Confirm VPN Adapter Removal</h4>
              </div>
              <p id="vpnsetup-remove-modal-desc" class="vpnsetup-remove-modal-copy">
                Removing the VPN adapter may interrupt remote connectivity immediately. Use this only when you intend to disconnect this machine from VPN access.
              </p>
              <p id="vpnsetup-remove-countdown" class="vpnsetup-remove-countdown" aria-live="polite" aria-atomic="true"></p>
              <div class="vpnsetup-remove-modal-actions">
                <button id="vpnsetup-remove-cancel-btn" class="btn-secondary" type="button">Cancel</button>
                <button id="vpnsetup-remove-confirm-btn" class="btn-primary vpnsetup-remove-confirm-btn" type="button" disabled aria-disabled="true">
                  <span class="material-icons">delete_forever</span>
                  <span id="vpnsetup-remove-confirm-label">Confirm Remove (3)</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const installBtn = document.getElementById('vpnsetup-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', () => runVpnAdapterCommand('connect'));
    }

    const removeBtn = document.getElementById('vpnsetup-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => openRemoveConfirmDialog());
    }

    const checkBtn = document.getElementById('vpnsetup-check-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => refreshAdapterStatusFromPrereq(true));
    }

    const removeModalOverlay = document.getElementById('vpnsetup-remove-modal-overlay');
    if (removeModalOverlay) {
      removeModalOverlay.addEventListener('click', (event) => {
        if (event.target === removeModalOverlay) {
          closeRemoveConfirmDialog(true);
        }
      });
    }

    const removeModal = document.getElementById('vpnsetup-remove-modal');
    if (removeModal) {
      removeModal.focus();
      removeModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeRemoveConfirmDialog(true);
        }
      });
    }

    const removeCancelBtn = document.getElementById('vpnsetup-remove-cancel-btn');
    if (removeCancelBtn) {
      removeCancelBtn.addEventListener('click', () => closeRemoveConfirmDialog(true));
    }

    const removeConfirmBtn = document.getElementById('vpnsetup-remove-confirm-btn');
    if (removeConfirmBtn) {
      removeConfirmBtn.addEventListener('click', () => {
        confirmRemoveAdapter();
      });
      updateRemoveConfirmDialogInPlace();
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
