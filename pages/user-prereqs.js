// ============================================
// USER PREREQUISITES PAGE
// ============================================

function renderUserPrereqsPage() {
  const container = document.getElementById('page-user-prereqs');
  container.innerHTML = '';

  // ---- Checklist header ----
  const header = document.createElement('div');
  header.className = 'card p-8 mb-8';
  header.innerHTML = `
    <h2 class="text-xl font-semibold text-rewst-black mb-2">User Prerequisites</h2>
    <p class="text-rewst-gray mb-6">Running user-level validation checks...</p>
  `;
  container.appendChild(header);

  // ---- Checklist items container ----
  const checklistContainer = document.createElement('div');
  checklistContainer.className = 'space-y-3';
  container.appendChild(checklistContainer);

  // ---- Create checklist items with loading state ----
  const checkItem = document.createElement('div');
  checkItem.className = 'card p-4 flex items-center gap-3';
  checkItem.id = 'check-cwm-config';
  checkItem.innerHTML = `
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
  checklistContainer.appendChild(checkItem);

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
        checkItem.innerHTML = `
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
        return;
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
        checkItem.innerHTML = `
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
        checkItem.innerHTML = `
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
          const computerOnlineResult = await rewst.runWorkflow('019dc20b-e6e1-750e-abcd-9814d0c592b6', { cwa_computer_id: selectedConfig.deviceIdentifier });
          debugLog('Computer Online result:', computerOnlineResult);

          const onlineValue = computerOnlineResult.output.online;
          const isOnline = !!onlineValue; // Check if value exists

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
        checkItem.innerHTML = '';
        checkItem.className = 'card p-4 flex items-start gap-3';

        // Info icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'text-orange-500 pt-1 flex-shrink-0';
        iconDiv.innerHTML = '<span class="material-icons">info</span>';
        checkItem.appendChild(iconDiv);

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
        checkItem.appendChild(contentDiv);

        // Run computer online check with the default selected device identifier
        try {
          const computerOnlineResult = await rewst.runWorkflowSmart('019dc20b-e6e1-750e-abcd-9814d0c592b6', { cwa_computer_id: selectedConfig.deviceIdentifier });
          debugLog('Computer Online result:', computerOnlineResult);

          const onlineValue = computerOnlineResult?.output?.online;
          const isOnline = !!onlineValue; // Check if value exists

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
      debugError('Workflow error:', error);

      checkItem.innerHTML = `
        <div class="text-red-500">
          <span class="material-icons">error</span>
        </div>
        <div class="flex-1">
          <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
          <p class="text-sm text-red-500">Error: ${error.message || 'Workflow execution failed'}</p>
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

      RewstDOM.showError('Failed to run workflow validation');
    }
  })();
}
