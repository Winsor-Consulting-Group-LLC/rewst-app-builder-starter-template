// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  const infoCard = RewstDOM.createCard(`
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

  container.appendChild(infoCard);
}
