function renderRemediationPage() {
  const container = document.getElementById('page-remediation');
  container.innerHTML = '';

  const REMEDIATION_CONTEXT_KEY = 'prereqMachineCertRemediationContextV1';
  const REMEDIATION_RETURN_KEY = 'prereqMachineCertRemediationReturnV1';

  const context = getStoredJson(REMEDIATION_CONTEXT_KEY);

  if (!context || context.checkKey !== 'valid_machine_cert_installed' || !context.cwaId) {
    const card = RewstDOM.createCard(`
      <div class="prereq-command-badge">
        <span class="material-icons">warning</span>
        <span>Remediation context missing</span>
      </div>
      <div class="prereq-command-row">
        <div class="prereq-command-left">
          <h2 class="prereq-command-title">No remediation session is available</h2>
          <p class="prereq-command-copy">Return to prerequisites and rerun the blocked check to start remediation again.</p>
        </div>
      </div>
    `);
    card.className = 'card prereq-command-card';
    container.appendChild(card);

    const actions = document.createElement('div');
    actions.className = 'prereq-actions';
    const button = document.createElement('button');
    button.className = 'btn-primary';
    button.innerHTML = '<span class="material-icons">arrow_back</span><span>Back to Prerequisites</span>';
    button.addEventListener('click', () => switchPage('prerequisites'));
    actions.appendChild(button);
    container.appendChild(actions);
    return;
  }

  const state = {
    phase: 'idle',
    inFlight: false,
    error: '',
    started: false,
    taskCount: 0,
    statusText: 'Preparing remediation workflow...'
  };

  // Load step definitions from shared workflow-step config.
  const workflowSteps = getWorkflowStepDefinitions('MACHINE_CERT_REMEDIATION_APPLY', [
    { minTasks: 0, maxTasks: Infinity, progressLabel: 'Run remediation', detail: 'Workflow in progress.' }
  ]);

  function getCurrentStepIndex() {
    return resolveWorkflowStepByTaskCount('MACHINE_CERT_REMEDIATION_APPLY', state.taskCount, workflowSteps).index;
  }

  function getStepCards() {
    const currentIndex = getCurrentStepIndex();
    const isFailed = state.phase === 'failed';
    const isDone = state.phase === 'done';

    return workflowSteps.map((step, i) => {
      const maxTasks = Number.isFinite(step?.maxTasks) ? step.maxTasks : Infinity;
      const stepComplete = isDone || state.taskCount > maxTasks;
      let status;
      if (stepComplete) {
        status = 'Done';
      } else if (isFailed && i === currentIndex) {
        status = 'Failed';
      } else if (i === currentIndex && state.inFlight) {
        status = 'Running';
      } else if (i < currentIndex) {
        status = 'Done';
      } else {
        status = 'Pending';
      }
      return { title: step.progressLabel || 'Workflow step', detail: step.detail || '', status };
    });
  }

  function render() {
    const stepData = getStepCards();
    const statusBadge = state.phase === 'failed' ? 'Attention' : state.phase === 'done' ? 'Complete' : 'In Progress';
    const cadenceText = state.inFlight
      ? `${state.taskCount} steps complete — ${state.statusText}`
      : state.phase === 'failed'
        ? "Something didn't work. You can try again or contact support."
        : state.phase === 'done'
          ? 'The fix is complete. Head back to prerequisites to continue.'
          : 'Preparing...';

    const card = RewstDOM.createCard(`
      <div class="prereq-command-badge">
        <span class="material-icons">build_circle</span>
        <span>Machine Certificate Remediation</span>
      </div>
      <div class="prereq-command-row">
        <div class="prereq-command-left">
          <h2 class="prereq-command-title">A fix is needed before VPN setup can continue</h2>
          <p class="prereq-command-copy">We're repairing a certificate issue on your device. This usually completes in a few minutes.</p>
        </div>
        <div class="prereq-command-right">
          <div class="prereq-progress-header">
            <span class="prereq-progress-label">Remediation Status</span>
            <span class="prereq-progress-value">${statusBadge}</span>
          </div>
          <p class="prereq-cadence-label">${cadenceText}</p>
        </div>
      </div>
    `);
    card.className = 'card prereq-command-card';

    const stepsWrap = document.createElement('div');
    stepsWrap.className = 'prereq-checklist';
    stepData.forEach((step) => {
      const stepCard = RewstDOM.createCard(`
        <div class="prereq-check-icon ${step.status === 'Done' ? 'is-passed' : step.status === 'Failed' ? 'is-failed' : step.status === 'Running' ? 'is-running' : 'is-pending'}">
          <span class="material-icons ${step.status === 'Running' ? 'prereq-icon-spin' : ''}">${step.status === 'Done' ? 'check_circle' : step.status === 'Failed' ? 'cancel' : step.status === 'Running' ? 'sync' : 'schedule'}</span>
        </div>
        <div class="prereq-check-content">
          <p class="prereq-check-title">${step.title}</p>
          <p class="prereq-check-detail">${step.status}</p>
        </div>
      `);
      stepCard.className = 'card prereq-check-card';
      stepsWrap.appendChild(stepCard);
    });

    const actions = document.createElement('div');
    actions.className = 'prereq-actions';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '0.75rem';
    actions.style.flexWrap = 'wrap';

    const backButton = document.createElement('button');
    backButton.className = 'btn-secondary';
    backButton.innerHTML = '<span class="material-icons">arrow_back</span><span>Back to Prerequisites</span>';
    backButton.disabled = state.inFlight;
    backButton.addEventListener('click', () => switchPage('prerequisites'));
    actions.appendChild(backButton);

    const ticketButton = document.createElement('button');
    ticketButton.className = 'btn-secondary';
    ticketButton.innerHTML = '<span class="material-icons">confirmation_number</span><span>Open ticket</span>';
    ticketButton.disabled = !(state.phase === 'failed' && !state.inFlight);
    ticketButton.addEventListener('click', async () => {
      if (ticketButton.disabled) return;
      state.inFlight = true;
      render();
      const attempt = await runSingleAttempt(
        () => rewst.runWorkflowSmart(getWorkflowId('OPEN_TICKET'), {
          check_key: context.checkKey,
          cwa_computer_id: context.cwaId,
          remediation_target_id: '',
          remediation_target_label: '',
          remediation_error: state.error || ''
        }),
        'Machine certificate remediation ticket'
      );
      state.inFlight = false;
      if (attempt.ok) {
        RewstDOM.showSuccess('Support ticket created successfully.');
      } else {
        state.error = attempt.error?.message || 'Unable to create support ticket';
        RewstDOM.showError(state.error);
      }
      render();
    });
    actions.appendChild(ticketButton);

    const primaryButton = document.createElement('button');
    primaryButton.className = 'btn-primary';
    primaryButton.disabled = state.inFlight;
    primaryButton.innerHTML = `<span class="material-icons">${state.phase === 'failed' ? 'refresh' : state.phase === 'done' ? 'arrow_back' : 'hourglass_top'}</span><span>${state.phase === 'failed' ? 'Retry remediation' : state.phase === 'done' ? 'Return to Prerequisites' : 'Running...'}</span>`;
    primaryButton.addEventListener('click', async () => {
      if (state.inFlight) return;

      if (state.phase === 'failed') {
        state.started = false;
        state.phase = 'idle';
        state.error = '';
        state.taskCount = 0;
        state.statusText = 'Preparing remediation workflow...';
        render();
        await runRemediationWorkflow();
        return;
      }

      if (state.phase === 'done') {
        switchPage('prerequisites');
      }
    });
    actions.appendChild(primaryButton);

    container.innerHTML = '';
    container.appendChild(card);
    container.appendChild(stepsWrap);
    if (state.error) {
      const errorCard = RewstDOM.createCard(`
        <div class="prereq-check-icon is-failed"><span class="material-icons">error</span></div>
        <div class="prereq-check-content">
          <p class="prereq-check-title">Remediation error</p>
          <p class="prereq-check-detail">${state.error}</p>
        </div>
      `);
      errorCard.className = 'card prereq-check-card is-failed';
      container.appendChild(errorCard);
    }
    container.appendChild(actions);
  }

  async function runRemediationWorkflow() {
    if (state.started || state.inFlight) return;
    state.started = true;
    state.inFlight = true;
    state.phase = 'running';
    state.error = '';
    state.taskCount = 0;
    state.statusText = 'Starting remediation workflow...';
    render();

    const attempt = await runSingleAttempt(
      () => rewst.runWorkflowSmart(getWorkflowId('MACHINE_CERT_REMEDIATION_APPLY'), {
        in_cwa_id: context.cwaId
      }, {
        onProgress: (status, numSuccessfulTasks) => {
          if (Number.isFinite(numSuccessfulTasks)) {
            state.taskCount = numSuccessfulTasks;
          }
          state.statusText = formatWorkflowProgressDetails(status, null);
          render();
        }
      }),
      'Machine certificate remediation workflow'
    );

    state.inFlight = false;
    if (!attempt.ok) {
      state.phase = 'failed';
      state.error = attempt.error?.message || 'Discovery workflow failed';
      RewstDOM.showError(state.error);
      render();
      return;
    }

    if (getBooleanFieldValue(attempt.result, ['success', 'remediation_success', 'remediationSuccess', 'completed']).parsed === false) {
      state.phase = 'failed';
      state.error = 'Remediation workflow did not report success.';
      RewstDOM.showError(state.error);
      render();
      return;
    }

    state.phase = 'done';
    setStoredJson(REMEDIATION_RETURN_KEY, context);
    clearStoredKey(REMEDIATION_CONTEXT_KEY);
    RewstDOM.showSuccess('The fix is complete. Return to prerequisites to continue.');
    render();
  }

  render();
  runRemediationWorkflow();
}