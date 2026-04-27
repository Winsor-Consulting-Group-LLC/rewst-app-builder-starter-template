// ============================================
// VPN SETUP PAGE
// ============================================

function renderVpnSetupPage() {
  const container = document.getElementById('page-vpnsetup');
  container.innerHTML = '';

  const infoCard = RewstDOM.createCard(`
    <div class="flex items-start gap-3">
      <div class="text-green-500 mt-0.5">
        <span class="material-icons">check_circle</span>
      </div>
      <div>
        <p class="text-rewst-dark-gray font-medium">Computer prerequisite checks are complete</p>
        <p class="text-sm text-rewst-gray mt-1">All validation checks now run on the Prerequisites page before you continue here.</p>
      </div>
    </div>
  `);
  infoCard.className = 'card p-5';

  container.appendChild(infoCard);
}
