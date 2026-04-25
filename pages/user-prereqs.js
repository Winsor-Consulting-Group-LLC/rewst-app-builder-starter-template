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

  // ---- Create checklist item with loading state ----
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

  // ---- Run workflow and check results ----
  (async () => {
    try {
      // Get current user email
      let userEmail = null;
      try {
        // // Try to get email from rewst object
        // userEmail = rewst.user?.email || rewst.currentUser?.email || window.rewstUserEmail;
        const usernameResult = await rewst.runWorkflow('019dc1f6-fc2c-7ec7-8c4a-19d722755c30');
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
        RewstDOM.showError('Failed to get user email');
        return;
      }

      debugLog('Current user email:', userEmail);

      // Run user prerequisites workflow with email input
      const userPrereqsResult = await rewst.runWorkflow('018c459c-206f-780c-94bc-46f98bbb5933', { user_principal_name: userEmail });
      debugLog('User Prereqs result:', userPrereqsResult);

      const userPrereqsData = userPrereqsResult?.output || userPrereqsResult;
      const cwmConfigs = userPrereqsData?.cwm_configurations || [];

      debugLog('CWM Configurations:', cwmConfigs);

      // Validate configurations
      const validConfigs = cwmConfigs.filter(config =>
        config && typeof config === 'object' && config.name && config.id
      );

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
      } else if (validConfigs.length === 1) {
        // Single configuration - pass
        checkItem.innerHTML = `
          <div class="text-green-500">
            <span class="material-icons">check_circle</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">CWM Configuration</p>
            <p class="text-sm text-rewst-gray">Passed - Selected: ${validConfigs[0].name}</p>
          </div>
        `;
      } else {
        // Multiple configurations - show dropdown
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

      RewstDOM.showError('Failed to run workflow validation');
    }
  })();
}
