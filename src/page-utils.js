// ============================================
// Shared utilities used across pages/*.js files.
// Loaded into the same module scope as the page render functions
// (see dashboard-spa-main-template.html), so they can call debugWarn,
// resolveWorkflowStepByTaskCount, etc. directly.
// ============================================

// ---------- Workflow IDs ----------

function getWorkflowId(key) {
  const workflowIds = window.WORKFLOW_IDS || {};
  const id = workflowIds[key];
  if (!id) {
    throw new Error(`Missing workflow ID for ${key}. Set it in src/workflow-ids.local.js`);
  }
  return id;
}

// ---------- Session storage (JSON) ----------

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

function clearStoredKey(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    debugWarn(`Failed to clear session key ${key}:`, error);
  }
}

// ---------- Workflow result extraction ----------

// Rewst workflow outputs can be nested in various shapes depending on how
// they're configured. This returns a list of candidate objects to search
// for output fields in. Stringified JSON payloads are parsed.
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

// Searches across all candidate output objects for the first non-null value
// matching any of the given field names. Falls through to a deep recursive
// search if no top-level match is found.
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
          if (item && typeof item === 'object') stack.push(item);
        });
      } else {
        Object.values(current).forEach((value) => {
          if (value && typeof value === 'object') stack.push(value);
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

// Normalizes loosely-typed "boolean" values from workflow outputs.
// Workflows may return 'true', 'yes', '1', 'online', etc.
function parseBooleanLike(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'online', 'connected', 'up', 'completed', 'success'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0', 'offline', 'disconnected', 'down', 'failed', 'error'].includes(normalized)) return false;
  }
  return null;
}

function getBooleanFieldValue(result, fieldNames) {
  const rawValue = getFirstFieldValue(result, fieldNames);
  return {
    rawValue,
    parsed: parseBooleanLike(rawValue)
  };
}

// ---------- Formatters ----------

function formatDuration(ms) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Builds a human-readable status line from a workflow's progress callback.
// If `maxWaitMs` is provided, includes an elapsed-out-of-max suffix.
function formatWorkflowProgressDetails(status, numSuccessfulTasks, workflowKey = null, startedAt = null, maxWaitMs = null) {
  const taskPrefix = Number.isFinite(numSuccessfulTasks) ? `${numSuccessfulTasks} steps complete — ` : '';
  const canResolveSteps = typeof resolveWorkflowStepByTaskCount === 'function';
  const resolvedStep = workflowKey && canResolveSteps
    ? resolveWorkflowStepByTaskCount(workflowKey, numSuccessfulTasks)
    : null;
  const configuredLabel = resolvedStep?.step?.progressLabel || null;

  if (configuredLabel) {
    return `${taskPrefix}${configuredLabel}.`;
  }

  const normalizedStatus = typeof status === 'string' && status.trim()
    ? status.trim().replace(/_/g, ' ').toLowerCase()
    : 'processing';

  if (startedAt && Number.isFinite(maxWaitMs)) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(0, maxWaitMs - elapsedMs);
    return `${taskPrefix}Workflow is ${normalizedStatus}. Waiting up to ${formatDuration(remainingMs)}.`;
  }

  return `${taskPrefix}Workflow is ${normalizedStatus}.`;
}

// ---------- Workflow execution wrapper ----------

function isWorkflowTimeoutError(error) {
  return /timeout/i.test(error?.message || '');
}

async function runSingleAttempt(task, operationName = 'workflow') {
  const startedAt = Date.now();
  try {
    debugLog(`[Workflow] ${operationName}: starting`);
    const result = await task();
    const elapsedMs = Date.now() - startedAt;
    debugLog(`[Workflow] ${operationName}: completed in ${elapsedMs}ms`);
    return { ok: true, result, error: null, elapsedMs, timedOut: false };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    debugWarn(`[Workflow] ${operationName}: failed after ${elapsedMs}ms`, error);
    return {
      ok: false,
      result: null,
      error,
      elapsedMs,
      timedOut: isWorkflowTimeoutError(error)
    };
  }
}

// Expose for console debugging.
window.PageUtils = {
  getWorkflowId,
  getStoredJson,
  setStoredJson,
  clearStoredKey,
  buildResultDataCandidates,
  getFirstFieldValue,
  parseBooleanLike,
  getBooleanFieldValue,
  formatDuration,
  formatWorkflowProgressDetails,
  isWorkflowTimeoutError,
  runSingleAttempt
};
