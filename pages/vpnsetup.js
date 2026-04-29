// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  // The entire page lives inside a single "scene" wrapper for layout/animation purposes.
  const scene = document.createElement('div');
  scene.className = 'vpnsetup-scene';

  scene.innerHTML = `
    <!-- Hero card: full-width dramatic banner at the top of the page.
         The orbit divs are purely decorative animated rings (CSS animation).
         This section does NOT trigger any real actions. -->
    <section class="vpnsetup-hero card">
      <div class="vpnsetup-hero-orbit vpnsetup-hero-orbit-primary"></div>
      <div class="vpnsetup-hero-orbit vpnsetup-hero-orbit-secondary"></div>

      <div class="vpnsetup-hero-header">
        <div class="vpnsetup-hero-icon-wrap" aria-hidden="true">
          <span class="material-icons vpnsetup-hero-icon">bolt</span>
        </div>
        <div>
          <p class="vpnsetup-hero-kicker">Network Orchestration Layer</p>
          <h2 class="vpnsetup-hero-title">VPN Setup Matrix Is Primed</h2>
        </div>
      </div>

      <p class="vpnsetup-hero-copy">
        Your machine has passed every prerequisite gate. Each interaction here now drives
        policy checks, certificate trust paths, and tunnel lifecycle operations behind the curtain.
      </p>

        <!-- Energy cells: purely decorative animated scan bars. aria-hidden so screen readers skip them. -->
      <div class="vpnsetup-energy-grid" role="presentation" aria-hidden="true">
        <span class="vpnsetup-energy-cell"></span>
        <span class="vpnsetup-energy-cell"></span>
        <span class="vpnsetup-energy-cell"></span>
        <span class="vpnsetup-energy-cell"></span>
        <span class="vpnsetup-energy-cell"></span>
      </div>

      <div class="vpnsetup-status-strip">
          <!-- Static status badges — these are decorative, not live data. -->
        <div class="vpnsetup-status-item">
          <span class="material-icons">verified_user</span>
          <span>Identity Chain: Verified</span>
        </div>
        <div class="vpnsetup-status-item">
          <span class="material-icons">dns</span>
          <span>Control Plane: Standing By</span>
        </div>
        <div class="vpnsetup-status-item">
          <span class="material-icons">shield</span>
          <span>Security Posture: Hardened</span>
        </div>
      </div>

      <p class="vpnsetup-disclaimer-note">
          <!-- Small disclaimer reminding anyone who reads the source that this is a demo UI. -->
        Demonstration interface only: this panel is aesthetic telemetry and does not execute real VPN actions yet.
      </p>
    </section>

    <section class="vpnsetup-grid">
        <!-- Pipeline Pressure card: animated readiness meters. All values are static/decorative. -->
      <article class="card vpnsetup-panel vpnsetup-panel-flow">
        <div class="vpnsetup-panel-head">
          <h3 class="vpnsetup-panel-title">Pipeline Pressure</h3>
          <span class="vpnsetup-panel-badge">Live</span>
        </div>

        <p class="vpnsetup-panel-copy">
          Readiness checks are complete. The setup engine is staged and waiting for operator intent.
        </p>

        <div class="vpnsetup-meter-stack" aria-label="Setup readiness meters">
          <div class="vpnsetup-meter-row">
            <span class="vpnsetup-meter-label">Credential Sync</span>
            <div class="vpnsetup-meter-track"><span class="vpnsetup-meter-fill is-high"></span></div>
          </div>
          <div class="vpnsetup-meter-row">
            <span class="vpnsetup-meter-label">Tunnel Policy</span>
            <div class="vpnsetup-meter-track"><span class="vpnsetup-meter-fill is-max"></span></div>
          </div>
          <div class="vpnsetup-meter-row">
            <span class="vpnsetup-meter-label">Endpoint Trust</span>
            <div class="vpnsetup-meter-track"><span class="vpnsetup-meter-fill is-high"></span></div>
          </div>
        </div>
      </article>

      <article class="card vpnsetup-panel">
          <!-- Operational Sequence: ordered list of VPN setup steps.
           is-complete = done (green check), is-pending = not yet run (grey).
           These states are hardcoded for visual effect — the steps don't actually execute. -->
        <div class="vpnsetup-panel-head">
          <h3 class="vpnsetup-panel-title">Operational Sequence</h3>
          <span class="vpnsetup-panel-badge is-ready">Ready</span>
        </div>

        <ol class="vpnsetup-sequence" aria-label="VPN setup sequence">
          <li class="vpnsetup-sequence-item is-complete">
            <span class="material-icons">task_alt</span>
            <div>
              <p class="vpnsetup-sequence-title">Preflight Validation</p>
              <p class="vpnsetup-sequence-detail">All prerequisite checks passed in staging.</p>
            </div>
          </li>
          <li class="vpnsetup-sequence-item is-complete">
            <span class="material-icons">key</span>
            <div>
              <p class="vpnsetup-sequence-title">Credential Handshake</p>
              <p class="vpnsetup-sequence-detail">Device identity and auth pathways are aligned.</p>
            </div>
          </li>
          <li class="vpnsetup-sequence-item is-pending">
            <span class="material-icons">route</span>
            <div>
              <p class="vpnsetup-sequence-title">Tunnel Route Deployment</p>
              <p class="vpnsetup-sequence-detail">Queued for execution on next setup action.</p>
            </div>
          </li>
          <li class="vpnsetup-sequence-item is-pending">
            <span class="material-icons">lan</span>
            <div>
              <p class="vpnsetup-sequence-title">Interocitor Connectivity Verification</p>
              <p class="vpnsetup-sequence-detail">Final Metalunan endpoint checks trigger post-Zagon destruction of the planet.</p>
            </div>
          </li>
        </ol>
      </article>
    </section>
  `;

  const infoCard = RewstDOM.createCard(`
      <!-- Small info banner that summarises why the user is on this page. -->
    <div class="vpnsetup-info-row">
      <div class="vpnsetup-info-icon">
        <span class="material-icons">check_circle</span>
      </div>
      <div class="vpnsetup-info-content">
        <p class="vpnsetup-info-title">Computer prerequisite checks are complete</p>
        <p class="vpnsetup-info-detail">All validation checks now run on the Prerequisites page before you continue here.</p>
      </div>
    </div>
  `);
  infoCard.className = 'card vpnsetup-info-card';

  scene.appendChild(infoCard);
    // infoCard goes after the main scene sections, then the whole scene is added to the page.
  container.appendChild(scene);
}
