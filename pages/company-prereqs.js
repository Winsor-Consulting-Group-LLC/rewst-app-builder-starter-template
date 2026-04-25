// ============================================
// COMPANY PREREQUISITES PAGE
// ============================================

function renderCompanyPrereqsPage() {
  const container = document.getElementById('page-company-prereqs');
  container.innerHTML = '';

  // ---- Checklist header ----
  const header = document.createElement('div');
  header.className = 'card p-8 mb-8';
  header.innerHTML = `
    <h2 class="text-xl font-semibold text-rewst-black mb-2">Company Prerequisites</h2>
    <p class="text-rewst-gray mb-6">Running company-level validation checks...</p>
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
      // Run company prerequisites workflow
      const companyPrereqsResult = await rewst.runWorkflowSmart('019dc183-516c-7a50-bf66-3705e87e3fda');
      debugLog('Company Prereqs result:', companyPrereqsResult);

      // Extract output if nested
      const companyPrereqsData = companyPrereqsResult?.output || companyPrereqsResult;

      // Check ca_name and ad_domain
      const caCheck = companyPrereqsData?.ca_name;
      const adCheck = companyPrereqsData?.ad_domain;

      const element1 = checkElements['ca_name'];
      const statusIcon1 = caCheck ? 'check_circle' : 'cancel';
      const statusClass1 = caCheck ? 'text-green-500' : 'text-red-500';
      const statusText1 = caCheck ? 'Passed' : 'Failed';

      element1.innerHTML = `
        <div class="${statusClass1}">
          <span class="material-icons">${statusIcon1}</span>
        </div>
        <div class="flex-1">
          <p class="text-rewst-dark-gray font-medium">CA Name</p>
          <p class="text-sm text-rewst-gray">${statusText1}${caCheck ? ` - Data: ${caCheck}` : ''}</p>
        </div>
      `;

      const element2 = checkElements['ad_domain'];
      const statusIcon2 = adCheck ? 'check_circle' : 'cancel';
      const statusClass2 = adCheck ? 'text-green-500' : 'text-red-500';
      const statusText2 = adCheck ? 'Passed' : 'Failed';

      element2.innerHTML = `
        <div class="${statusClass2}">
          <span class="material-icons">${statusIcon2}</span>
        </div>
        <div class="flex-1">
          <p class="text-rewst-dark-gray font-medium">AD Domain</p>
          <p class="text-sm text-rewst-gray">${statusText2}${adCheck ? ` - Data: ${adCheck}` : ''}</p>
        </div>
      `;
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
