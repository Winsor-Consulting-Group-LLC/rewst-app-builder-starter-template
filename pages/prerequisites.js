// ============================================
// PREREQUISITES PAGE (Company + User)
// ============================================

function renderPrerequisitesPage() {
  const container = document.getElementById('page-prerequisites');
  container.innerHTML = '';

  // ---- Main header ----
  const header = document.createElement('div');
  header.className = 'card p-8 mb-8';
  header.innerHTML = `
    <h2 class="text-xl font-semibold text-rewst-black mb-2">Prerequisites</h2>
    <p class="text-rewst-gray mb-6">Running validation checks...</p>
  `;
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

  // Company check items
  const companyChecks = [
    { id: 'ca_name', label: 'CA Name' },
    { id: 'ad_domain', label: 'AD Domain' }
  ];

  const companyCheckElements = {};
  companyChecks.forEach(check => {
    const checkItem = document.createElement('div');
    checkItem.className = 'card p-4 flex items-center gap-3';
    checkItem.id = `check-${check.id}`;
    checkItem.innerHTML = `
      <div class="text-rewst-gray">
        <div class="animate-spin">
          <span class="material-icons">hourglass_empty</span>
        </div>
      </div>
      <div class="flex-1">
        <p class="text-rewst-dark-gray font-medium">${check.label}</p>
        <p class="text-sm text-rewst-gray">Validating...</p>
      </div>
    `;
    checklistContainer.appendChild(checkItem);
    companyCheckElements[check.id] = checkItem;
  });

  // ---- User checks section ----
  const userSectionHeader = document.createElement('div');
  userSectionHeader.className = 'mt-6 mb-3';
  userSectionHeader.innerHTML = '<h3 class="text-lg font-semibold text-rewst-dark-gray">User Prerequisites</h3>';
  checklistContainer.appendChild(userSectionHeader);

  // User check items
  const cwmCheckItem = document.createElement('div');
  cwmCheckItem.className = 'card p-4 flex items-center gap-3';
  cwmCheckItem.id = 'check-cwm-config';
  cwmCheckItem.innerHTML = `
    <div class="text-rewst-gray">
      <div class="animate-spin">
        <span class="material-icons">hourglass_empty</span>
      </div>
    </div>
    <div class="flex-1">
      <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
      <p class="text-sm text-rewst-gray">Validating...</p>
    </div>
  `;
  checklistContainer.appendChild(cwmCheckItem);

  const computerOnlineCheckItem = document.createElement('div');
  computerOnlineCheckItem.className = 'card p-4 flex items-center gap-3';
  computerOnlineCheckItem.id = 'check-computer-online';
  computerOnlineCheckItem.innerHTML = `
    <div class="text-rewst-gray">
      <div class="animate-spin">
        <span class="material-icons">hourglass_empty</span>
      </div>
    </div>
    <div class="flex-1">
      <p class="text-rewst-dark-gray font-medium">Computer Online</p>
      <p class="text-sm text-rewst-gray">Validating...</p>
    </div>
  `;
  checklistContainer.appendChild(computerOnlineCheckItem);

  // ---- Run workflow and check results ----
  (async () => {
    try {
      // ===== STEP 1: Run Company Prerequisites =====
      debugLog('Starting company prerequisites checks...');
      
      try {
        const companyPrereqsResult = await rewst.runWorkflowSmart('019dc183-516c-7a50-bf66-3705e87e3fda');
        debugLog('Company Prereqs result:', companyPrereqsResult);

        const companyPrereqsData = companyPrereqsResult?.output || companyPrereqsResult;

        // Check ca_name and ad_domain
        const caCheck = companyPrereqsData?.ca_name;
        const adCheck = companyPrereqsData?.ad_domain;

        // Update CA Name check
        const caElement = companyCheckElements['ca_name'];
        const caStatusIcon = caCheck ? 'check_circle' : 'cancel';
        const caStatusClass = caCheck ? 'text-green-500' : 'text-red-500';
        const caStatusText = caCheck ? 'Passed' : 'Failed';

        caElement.innerHTML = `
          <div class="${caStatusClass}">
            <span class="material-icons">${caStatusIcon}</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">CA Name</p>
            <p class="text-sm text-rewst-gray">${caStatusText}${caCheck ? ` - Data: ${caCheck}` : ''}</p>
          </div>
        `;

        // Update AD Domain check
        const adElement = companyCheckElements['ad_domain'];
        const adStatusIcon = adCheck ? 'check_circle' : 'cancel';
        const adStatusClass = adCheck ? 'text-green-500' : 'text-red-500';
        const adStatusText = adCheck ? 'Passed' : 'Failed';

        adElement.innerHTML = `
          <div class="${adStatusClass}">
            <span class="material-icons">${adStatusIcon}</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">AD Domain</p>
            <p class="text-sm text-rewst-gray">${adStatusText}${adCheck ? ` - Data: ${adCheck}` : ''}</p>
          </div>
        `;

        debugLog('Company checks completed');
      } catch (companyError) {
        debugError('Company Workflow error:', companyError);

        // Mark company checks as failed
        companyChecks.forEach(check => {
          const element = companyCheckElements[check.id];
          element.innerHTML = `
            <div class="text-red-500">
              <span class="material-icons">error</span>
            </div>
            <div class="flex-1">
              <p class="text-rewst-dark-gray font-medium">${check.label}</p>
              <p class="text-sm text-red-500">Error: ${companyError.message || 'Workflow execution failed'}</p>
            </div>
          `;
        });

        RewstDOM.showError('Failed to run company prerequisites');
        throw companyError;
      }

      // ===== STEP 2: Run User Prerequisites =====
      debugLog('Starting user prerequisites checks...');
      
      // Get current user email
      let userEmail = null;
      try {
        const usernameResult = await rewst.runWorkflowSmart('019dc1f6-fc2c-7ec7-8c4a-19d722755c30');
        userEmail = usernameResult.output.username;
        if (!userEmail) {
          debugWarn('Could not find user email in rewst object');
          throw new Error('Could not determine current user email');
        }
      } catch (err) {
        debugError('Failed to get user email:', err);
        cwmCheckItem.innerHTML = `
          <div class="text-red-500">
            <span class="material-icons">error</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
            <p class="text-sm text-red-500">Error: Could not determine current user email</p>
          </div>
        `;
        computerOnlineCheckItem.innerHTML = `
          <div class="text-red-500">
            <span class="material-icons">error</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">Computer Online</p>
            <p class="text-sm text-red-500">Skipped - CWM Configuration check failed</p>
          </div>
        `;
        RewstDOM.showError('Failed to get user email');
        throw err;
      }

      debugLog('Current user email:', userEmail);

      // Run user prerequisites workflow with email input
      const userPrereqsResult = await rewst.runWorkflowSmart('018c459c-206f-780c-94bc-46f98bbb5933', { user_principal_name: userEmail });
      debugLog('User Prereqs result:', userPrereqsResult);

      const userPrereqsData = userPrereqsResult?.output || userPrereqsResult;
      const cwmConfigs = userPrereqsData?.cwm_configurations || [];

      debugLog('CWM Configurations:', cwmConfigs);

      // Validate configurations
      const validConfigs = cwmConfigs.filter(config =>
        config && typeof config === 'object' && config.name && config.id && config.deviceIdentifier
      );

      let selectedConfig = null;

      if (validConfigs.length === 0) {
        // No valid configurations found
        cwmCheckItem.innerHTML = `
          <div class="text-red-500">
            <span class="material-icons">cancel</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
            <p class="text-sm text-red-500">Failed - No valid configurations found</p>
          </div>
        `;
        computerOnlineCheckItem.innerHTML = `
          <div class="text-red-500">
            <span class="material-icons">error</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">Computer Online</p>
            <p class="text-sm text-red-500">Skipped - No valid CWM configuration</p>
          </div>
        `;
      } else if (validConfigs.length === 1) {
        // Single configuration - pass
        selectedConfig = validConfigs[0];
        cwmCheckItem.innerHTML = `
          <div class="text-green-500">
            <span class="material-icons">check_circle</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
            <p class="text-sm text-rewst-gray">Passed - Selected: ${selectedConfig.name}</p>
          </div>
        `;

        // Run computer online check with the device identifier
        try {
          const computerOnlineResult = await rewst.runWorkflowSmart('019dc20b-e6e1-750e-abcd-9814d0c592b6', { cwa_computer_id: selectedConfig.deviceIdentifier });
          debugLog('Computer Online result:', computerOnlineResult);

          const onlineValue = computerOnlineResult?.output?.online;
          const isOnline = !!onlineValue;

          const statusIcon = isOnline ? 'check_circle' : 'cancel';
          const statusClass = isOnline ? 'text-green-500' : 'text-red-500';
          const statusText = isOnline ? 'Passed' : 'Failed';

          computerOnlineCheckItem.innerHTML = `
            <div class="${statusClass}">
              <span class="material-icons">${statusIcon}</span>
            </div>
            <div class="flex-1">
              <p class="text-rewst-dark-gray font-medium">Computer Online</p>
              <p class="text-sm text-rewst-gray">${statusText}${isOnline ? ` - Status: ${onlineValue}` : ''}</p>
            </div>
          `;
        } catch (err) {
          debugError('Computer online check error:', err);
          computerOnlineCheckItem.innerHTML = `
            <div class="text-red-500">
              <span class="material-icons">error</span>
            </div>
            <div class="flex-1">
              <p class="text-rewst-dark-gray font-medium">Computer Online</p>
              <p class="text-sm text-red-500">Error: ${err.message || 'Failed to check computer status'}</p>
            </div>
          `;
        }
      } else {
        // Multiple configurations - show dropdown
        selectedConfig = validConfigs[0]; // Default to first
        cwmCheckItem.innerHTML = '';
        cwmCheckItem.className = 'card p-4 flex items-start gap-3';

        // Info icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'text-orange-500 pt-1 flex-shrink-0';
        iconDiv.innerHTML = '<span class="material-icons">info</span>';
        cwmCheckItem.appendChild(iconDiv);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex-1';

        const titleP = document.createElement('p');
        titleP.className = 'text-rewst-dark-gray font-medium';
        titleP.textContent = 'CWM Configuration';
        contentDiv.appendChild(titleP);

        const descP = document.createElement('p');
        descP.className = 'text-sm text-rewst-gray mb-3';
        descP.textContent = 'Multiple configurations found. Select one:';
        contentDiv.appendChild(descP);

        const dropdown = document.createElement('select');
        dropdown.className = 'px-3 py-2 border border-gray-300 rounded text-sm text-rewst-dark-gray bg-white';
        dropdown.style.width = '100%';

        validConfigs.forEach((config, index) => {
          const option = document.createElement('option');
          option.value = JSON.stringify(config);
          option.textContent = config.name;
          if (index === 0) option.selected = true;
          dropdown.appendChild(option);
        });

        contentDiv.appendChild(dropdown);
        cwmCheckItem.appendChild(contentDiv);

        // Run computer online check with the default selected device identifier
        try {
          const computerOnlineResult = await rewst.runWorkflowSmart('019dc20b-e6e1-750e-abcd-9814d0c592b6', { cwa_computer_id: selectedConfig.deviceIdentifier });
          debugLog('Computer Online result:', computerOnlineResult);

          const onlineValue = computerOnlineResult?.output?.online;
          const isOnline = !!onlineValue;

          const statusIcon = isOnline ? 'check_circle' : 'cancel';
          const statusClass = isOnline ? 'text-green-500' : 'text-red-500';
          const statusText = isOnline ? 'Passed' : 'Failed';

          computerOnlineCheckItem.innerHTML = `
            <div class="${statusClass}">
              <span class="material-icons">${statusIcon}</span>
            </div>
            <div class="flex-1">
              <p class="text-rewst-dark-gray font-medium">Computer Online</p>
              <p class="text-sm text-rewst-gray">${statusText}${isOnline ? ` - Status: ${onlineValue}` : ''}</p>
            </div>
          `;
        } catch (err) {
          debugError('Computer online check error:', err);
          computerOnlineCheckItem.innerHTML = `
            <div class="text-red-500">
              <span class="material-icons">error</span>
            </div>
            <div class="flex-1">
              <p class="text-rewst-dark-gray font-medium">Computer Online</p>
              <p class="text-sm text-red-500">Error: ${err.message || 'Failed to check computer status'}</p>
            </div>
          `;
        }
      }
    } catch (error) {
      debugError('Prerequisites workflow error:', error);
      RewstDOM.showError('Failed to run prerequisites validation');
    }
  })();
}
