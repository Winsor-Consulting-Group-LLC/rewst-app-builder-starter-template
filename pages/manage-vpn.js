// ============================================
// MANAGE VPN PAGE
// ============================================

function renderManageVpnPage() {
  const container = document.getElementById('page-manage-vpn');
  container.innerHTML = '';

  // ---- Checklist header ----
  const header = document.createElement('div');
  header.className = 'card p-8 mb-8';
  header.innerHTML = `
    <h2 class="text-xl font-semibold text-rewst-black mb-2">VPN Configuration Checklist</h2>
    <p class="text-rewst-gray mb-6">Running workflow validation checks...</p>
  `;
  container.appendChild(header);

  // ---- Checklist items container ----
  const checklistContainer = document.createElement('div');
  checklistContainer.className = 'space-y-3';
  container.appendChild(checklistContainer);

  // ---- Create checklist items with loading state ----
  const checks = [
    { id: 'ca_name', label: 'CA Name' },
    { id: 'ad_domain', label: 'AD Domain' }
  ];

  const checkElements = {};
  checks.forEach(check => {
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
    checkElements[check.id] = checkItem;
  });

  // ---- Run workflow and check results ----
  (async () => {
    try {
      const result = await rewst.runWorkflowSmart('019dc183-516c-7a50-bf66-3705e87e3fda');
      debugLog('Workflow result:', result);

      // Set result to the output object of the original result for easier access
      if (result && result.output) {
        Object.keys(result.output).forEach(key => {
          result[key] = result.output[key];
        });
      }

      // Check each item
      checks.forEach(check => {
        const hasData = result && result[check.id];
        const element = checkElements[check.id];
        const statusIcon = hasData ? 'check_circle' : 'cancel';
        const statusClass = hasData ? 'text-green-500' : 'text-red-500';
        const statusText = hasData ? 'Passed' : 'Failed';

        element.innerHTML = `
          <div class="${statusClass}">
            <span class="material-icons">${statusIcon}</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">${check.label}</p>
            <p class="text-sm text-rewst-gray">${statusText}${hasData ? ` - Data: ${result[check.id]}` : ''}</p>
          </div>
        `;
      });
    } catch (error) {
      debugError('Workflow error:', error);

      // Mark all as failed
      checks.forEach(check => {
        const element = checkElements[check.id];
        element.innerHTML = `
          <div class="text-red-500">
            <span class="material-icons">error</span>
          </div>
          <div class="flex-1">
            <p class="text-rewst-dark-gray font-medium">${check.label}</p>
            <p class="text-sm text-red-500">Error: ${error.message || 'Workflow execution failed'}</p>
          </div>
        `;
      });

      RewstDOM.showError('Failed to run workflow validation');
    }
  })();
}

