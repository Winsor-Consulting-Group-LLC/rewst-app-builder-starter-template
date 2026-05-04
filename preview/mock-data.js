'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO CONFIGURATION
// Edit these values, then restart `npm run preview` to change mock behavior.
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIOS = {
  // Scenarios: workflow_failed | null_return | zero_results | single_result | multiple_results
  cwm: 'single_result',

  // Scenarios: workflow_failed | null_return | pass
  online: 'pass',

  // Scenarios: workflow_failed | null_return | zero_certs | one_cert | many_certs
  cert: 'one_cert',
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK ORG / USER DATA  (always fixed — not scenario-dependent)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ORG_ID = 'mock-org-00000000-0000-0000-0000-000000000001';
const MOCK_USER_EMAIL = 'jdoe@winsorgroup.com';
const MOCK_USER_UPN = 'jdoe@winsorgroup.com';

const MOCK_ORG_VARIABLES = {
  ca_name:            'WinsorCA01',
  ad_domain:          'corp.winsorgroup.com',
  vpn_adapter_name:   'MachineVPN',
  vpn_server_address: '203.0.113.10',
  vpn_remote_networks:'10.0.0.0/8',
  vpn_nameservers:    '10.0.0.53',
  vpn_remote_domain:  'corp.winsorgroup.com',
};

// CWM config options used by the multi-result picker scenario
const CWM_CONFIG_POOL = [
  { name: 'WINSOR-LAPTOP-01',  id: 'cwm-id-1', deviceIdentifier: 'cwa-001' },
  { name: 'WINSOR-DESKTOP-02', id: 'cwm-id-2', deviceIdentifier: 'cwa-002' },
  { name: 'WINSOR-LAPTOP-03',  id: 'cwm-id-3', deviceIdentifier: 'cwa-003' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION STATE  (in-memory poll counter, reset per server restart)
// ─────────────────────────────────────────────────────────────────────────────

// Map<executionId, { polls: number, scenario: string, workflowKey: string }>
const executionState = new Map();

let _execCounter = 1;
function newExecutionId() {
  return `mock-exec-${String(_execCounter++).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ID → KEY  (maps real UUIDs to scenario keys)
// ─────────────────────────────────────────────────────────────────────────────

// Populated at startup by reading workflow-ids.local.js / workflow-ids.example.js
// via the caller (server.js passes these in).
let workflowIdMap = {}; // { 'uuid': 'CWM_CONFIGURATIONS', ... }

function setWorkflowIds(idMap) {
  workflowIdMap = idMap;
}

// Map workflow key → scenario key
const WORKFLOW_KEY_TO_SCENARIO = {
  CWM_CONFIGURATIONS:   'cwm',
  COMPUTER_ONLINE:      'online',
  COMPUTER_PREREQUISITES: 'cert',
  USER_EMAIL:           'user_email',
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK OUTPUT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildCwmOutput(scenario) {
  switch (scenario) {
    case 'zero_results':
      return { cwm_configurations: [] };
    case 'single_result':
      return { cwm_configurations: [CWM_CONFIG_POOL[0]] };
    case 'multiple_results':
      return { cwm_configurations: CWM_CONFIG_POOL };
    case 'null_return':
      return {};            // no cwm_configurations key at all
    default:
      return null;          // signals FAILED
  }
}

function buildOnlineOutput(scenario) {
  switch (scenario) {
    case 'pass':
      return { online: true };
    case 'null_return':
      return {};            // no online key
    default:
      return null;          // signals FAILED
  }
}

function buildCertOutput(scenario) {
  switch (scenario) {
    case 'zero_certs':
      return { ValidCertCount: 0, VPNConnections: null };
    case 'one_cert':
      return {
        ValidCertCount: 1,
        VPNConnections: {
          Name: 'MachineVPN',
          ServerAddress: '203.0.113.10',
          DnsSuffix: 'corp.winsorgroup.com',
          ConnectionStatus: 'Connected',
        },
      };
    case 'many_certs':
      return {
        ValidCertCount: 3,
        VPNConnections: {
          Name: 'MachineVPN',
          ServerAddress: '203.0.113.10',
          DnsSuffix: 'corp.winsorgroup.com',
          ConnectionStatus: 'Connected',
        },
      };
    case 'null_return':
      return {};            // no ValidCertCount key
    default:
      return null;          // signals FAILED
  }
}

function buildUserEmailOutput() {
  return { user_principal_name: MOCK_USER_UPN };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPHQL MOCK ROUTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point. Returns the full GraphQL response body (as a JS object)
 * for a given operation.
 *
 * @param {string} operationName
 * @param {object} variables
 * @returns {{ data: object }|{ errors: object[] }}
 */
function getMockResponse(operationName, variables) {
  switch (operationName) {

    // ── Init ─────────────────────────────────────────────────────────────────
    case 'getUserOrganization':
      return { data: { userOrganization: { id: MOCK_ORG_ID } } };

    // ── Org variables ────────────────────────────────────────────────────────
    case 'getVisibleOrgVariables': {
      const vars = Object.entries(MOCK_ORG_VARIABLES).map(([name, value], i) => ({
        id: `var-${i}`,
        name,
        value,
        category: 'vpn',
        cascade: false,
        organization: { id: MOCK_ORG_ID, name: 'Winsor Group' },
      }));
      return { data: { visibleOrgVariables: vars } };
    }

    // ── Managed orgs ─────────────────────────────────────────────────────────
    case 'getManagedOrgs':
      return { data: { organizations: [] } };

    // ── Workflow triggers (fallback path in runWorkflowSmart) ─────────────────
    case 'getWorkflowTriggers':
      return { data: { workflow: { id: variables.id, triggers: [] } } };

    // ── Start a workflow execution ────────────────────────────────────────────
    case 'testWorkflow': {
      const wfKey = workflowIdMap[variables.id] || 'UNKNOWN';
      const scenarioKey = WORKFLOW_KEY_TO_SCENARIO[wfKey];
      const scenario = scenarioKey ? SCENARIOS[scenarioKey] : 'pass';
      const executionId = newExecutionId();
      executionState.set(executionId, { polls: 0, scenario: scenario || 'pass', workflowKey: wfKey });
      console.log(`  [mock] testWorkflow  wf=${wfKey}  scenario=${scenario}  execId=${executionId}`);
      return { data: { testResult: { executionId, __typename: 'WorkflowExecution' } } };
    }

    // ── Poll execution status (without output) ────────────────────────────────
    case 'getExecution': {
      return handleGetExecution(variables, false);
    }

    // ── Poll execution status (with output — final fetch) ────────────────────
    case 'getExecutionWithOutput': {
      return handleGetExecution(variables, true);
    }

    default:
      console.log(`  [mock] unhandled operation: ${operationName}`);
      return { data: {} };
  }
}

function handleGetExecution(variables, includeOutput) {
  const execId = variables.id;
  const state = executionState.get(execId);

  if (!state) {
    return { errors: [{ message: 'Execution not found', extensions: { code: 'NOT_FOUND' } }] };
  }

  state.polls++;

  // First 2 polls → RUNNING (exercises the progress UI countdown)
  if (state.polls <= 2) {
    console.log(`  [mock] getExecution  execId=${execId}  poll=${state.polls}  status=RUNNING`);
    return {
      data: {
        workflowExecution: {
          id: execId,
          status: 'RUNNING',
          numSuccessfulTasks: state.polls * 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conductor: null,
          workflow: { id: 'mock-wf', name: state.workflowKey },
        },
      },
    };
  }

  // Poll 3+ → terminal
  const isFailureScenario = state.scenario === 'workflow_failed';
  const finalStatus = isFailureScenario ? 'FAILED' : 'COMPLETED';
  console.log(`  [mock] getExecution  execId=${execId}  poll=${state.polls}  status=${finalStatus}`);

  if (isFailureScenario) {
    return {
      data: {
        workflowExecution: {
          id: execId,
          status: 'FAILED',
          numSuccessfulTasks: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          conductor: { output: {}, input: {}, errors: [{ message: 'Workflow failed (simulated)' }] },
          workflow: { id: 'mock-wf', name: state.workflowKey },
        },
      },
    };
  }

  // Build output based on workflow key
  let output = {};
  switch (state.workflowKey) {
    case 'USER_EMAIL':           output = buildUserEmailOutput(); break;
    case 'CWM_CONFIGURATIONS':   output = buildCwmOutput(state.scenario) ?? {}; break;
    case 'COMPUTER_ONLINE':      output = buildOnlineOutput(state.scenario) ?? {}; break;
    case 'COMPUTER_PREREQUISITES': output = buildCertOutput(state.scenario) ?? {}; break;
    default:                     output = {};
  }

  return {
    data: {
      workflowExecution: {
        id: execId,
        status: 'COMPLETED',
        numSuccessfulTasks: 8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        conductor: includeOutput
          ? { output, input: {}, errors: [] }
          : null,
        workflow: { id: 'mock-wf', name: state.workflowKey },
      },
    },
  };
}

module.exports = { getMockResponse, setWorkflowIds };
