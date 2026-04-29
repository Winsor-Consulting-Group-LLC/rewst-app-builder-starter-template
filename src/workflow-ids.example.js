const WORKFLOW_IDS = {
  // Populate these IDs in src/workflow-ids.local.js (gitignored).
  USER_EMAIL: '',
  COMPANY_PREREQUISITES: '',
  CWM_CONFIGURATIONS: '',
  COMPUTER_ONLINE: '',
  COMPUTER_PREREQUISITES: '',
  MACHINE_CERT_REMEDIATION_APPLY: '019ddac0-808c-7ae4-9454-ae6488f6c089',
  OPEN_TICKET: ''
};

window.WORKFLOW_IDS = WORKFLOW_IDS;

// Progress step definitions for workflow status updates.
// Each entry maps a workflow key to an ordered array of task-count ranges.
// Use minTasks + maxTasks + progressLabel everywhere for consistency.
// detail is optional and can be used by checklist-style UIs.
const WORKFLOW_STEPS = {
  COMPUTER_PREREQUISITES: [
    {
      minTasks: 0,
      maxTasks: 7,
      progressLabel: 'Sending script to remote computer'
    },
    {
      minTasks: 8,
      maxTasks: 8,
      progressLabel: 'Awaiting response from remote computer'
    },
    {
      minTasks: 9,
      maxTasks: Infinity,
      progressLabel: 'Processing response'
    }
  ],
  MACHINE_CERT_REMEDIATION_APPLY: [
    {
      minTasks: 0,
      maxTasks: 12,
      progressLabel: 'Obtain CSR from remote computer',
      detail: 'Runs until successful task 13.'
    },
    {
      minTasks: 13,
      maxTasks: 22,
      progressLabel: 'Obtain signed certificate from CA',
      detail: 'Runs from task 13 to task 23.'
    },
    {
      minTasks: 23,
      maxTasks: Infinity,
      progressLabel: 'Install signed certificate on remote computer',
      detail: 'Runs from task 23 to workflow completion.'
    }
  ]
};

window.WORKFLOW_STEPS = WORKFLOW_STEPS;
