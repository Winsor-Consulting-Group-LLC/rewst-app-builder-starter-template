// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  const checklistContainer = document.createElement('div');
  checklistContainer.className = 'space-y-3';
  container.appendChild(checklistContainer);

  function createCardContainer(content, className) {
    const card = RewstDOM.createCard(content);
    card.className = className;
    return card;
  }

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

  const certCheckItem = createCheckCard('check-valid-machine-cert', 'Valid machine certificate installed');
  checklistContainer.appendChild(certCheckItem);

  const domainReachableCheckItem = createCheckCard('check-remote-domain-reachable', 'Remote domain reachable');
  checklistContainer.appendChild(domainReachableCheckItem);

  const checkStates = {
    valid_machine_cert_installed: false,
    remote_domain_reachable: false
  };

  const MAX_CHECK_ATTEMPTS = 3; // Initial run + 2 retries

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

  function getSelectedCwaId() {
    if (window.selectedConfig && window.selectedConfig.deviceIdentifier) {
      return window.selectedConfig.deviceIdentifier;
    }

    try {
      const raw = sessionStorage.getItem('selectedConfig');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.deviceIdentifier || null;
    } catch (e) {
      return null;
    }
  }

  function evaluateChecks(result) {
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

  function renderFromEvaluation(evaluation, attemptInfo = null) {
    checkStates.valid_machine_cert_installed = evaluation.certPassed;
    checkStates.remote_domain_reachable = evaluation.responseTimePassed;

    const certDetails = evaluation.certPassed
      ? `ValidCertCount: ${evaluation.validCertCountRaw}`
      : `ValidCertCount must be 1 or higher (received: ${evaluation.validCertCountRaw ?? 'none'})`;

    const domainDetails = evaluation.responseTimePassed
      ? `ResponseTime: ${evaluation.responseTime}ms`
      : `ResponseTime must be a positive integer under 10000 (received: ${evaluation.responseTimeRaw ?? 'none'})`;

    const failureSuffix = attemptInfo ? ` after ${attemptInfo.attempts} attempts` : '';

    renderCheckResult(
      certCheckItem,
      evaluation.certPassed,
      'Valid machine certificate installed',
      evaluation.certPassed ? certDetails : certDetails + failureSuffix,
      runVpnChecks
    );

    renderCheckResult(
      domainReachableCheckItem,
      evaluation.responseTimePassed,
      'Remote domain reachable',
      evaluation.responseTimePassed ? domainDetails : domainDetails + failureSuffix,
      runVpnChecks
    );
  }

  async function runVpnChecks() {
    setCheckLoading(certCheckItem, 'Valid machine certificate installed');
    setCheckLoading(domainReachableCheckItem, 'Remote domain reachable');

    const selectedCwaId = getSelectedCwaId();
    if (!selectedCwaId) {
      checkStates.valid_machine_cert_installed = false;
      checkStates.remote_domain_reachable = false;

      renderCheckResult(
        certCheckItem,
        false,
        'Valid machine certificate installed',
        'Missing CWA ID from prerequisites selectedConfig. Return to Prerequisites and complete CWM Configuration.',
        runVpnChecks
      );

      renderCheckResult(
        domainReachableCheckItem,
        false,
        'Remote domain reachable',
        'Missing CWA ID from prerequisites selectedConfig. Return to Prerequisites and complete CWM Configuration.',
        runVpnChecks
      );
      return;
    }

    const attemptResult = await runWithRetries(
      () => rewst.runWorkflowSmart('019dc156-1670-7384-94d4-fb6dc03ae4ed', { in_cwa_id: selectedCwaId }),
      (result) => {
        const evaluation = evaluateChecks(result);
        return evaluation.certPassed && evaluation.responseTimePassed;
      }
    );

    if (attemptResult.ok) {
      renderFromEvaluation(evaluateChecks(attemptResult.result));
      return;
    }

    if (attemptResult.error && !attemptResult.result) {
      const errorDetails = `${attemptResult.error.message || 'Workflow execution failed'} (after ${attemptResult.attempts} attempts)`;
      checkStates.valid_machine_cert_installed = false;
      checkStates.remote_domain_reachable = false;

      renderCheckResult(
        certCheckItem,
        false,
        'Valid machine certificate installed',
        errorDetails,
        runVpnChecks
      );

      renderCheckResult(
        domainReachableCheckItem,
        false,
        'Remote domain reachable',
        errorDetails,
        runVpnChecks
      );
      return;
    }

    renderFromEvaluation(evaluateChecks(attemptResult.result), attemptResult);
  }

  (async () => {
    debugLog('Starting VPN setup checks...');
    await runVpnChecks();
  })();
}
