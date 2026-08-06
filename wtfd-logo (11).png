const metricsEl = document.querySelector('#metrics');
const maintenanceRowsEl = document.querySelector('#maintenanceRows');
const forecastEl = document.querySelector('#forecast');
const syncTextEl = document.querySelector('#syncText');
const locationSummaryEl = document.querySelector('#locationSummary');
const refreshButton = document.querySelector('#refreshButton');

const formatDate = value => value ? new Intl.DateTimeFormat('en-US').format(new Date(value)) : 'Not available';
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

function renderMetrics(metrics) {
  const cards = [
    ['Overdue for maintenance', metrics.overdue, 'red'],
    ['Due in next 30 days', metrics.dueNext30Days, 'orange'],
    ['Due in 31–60 days', metrics.due31To60Days, 'yellow'],
    ['Retiring this year', metrics.retiringThisYear, 'purple'],
    ['Retiring next 3 years', metrics.retiringNext3Years, 'purple'],
    ['Warehouse gear', metrics.warehouseItems, 'blue'],
    ['Missing location', metrics.missingLocation, 'red']
  ];
  metricsEl.innerHTML = cards.map(([label, value, tone]) => `<article class="metric ${tone}"><div class="label">${label}</div><div class="value">${value}</div></article>`).join('');
}

function renderMaintenance(items) {
  maintenanceRowsEl.innerHTML = items.length ? items.map(item => {
    const statusClass = item.status.toLowerCase().replaceAll(' ', '-');
    const days = item.daysUntilDue < 0 ? `${Math.abs(item.daysUntilDue)} overdue` : item.daysUntilDue;
    return `<tr>
      <td>${escapeHtml(days)}</td>
      <td><strong>${escapeHtml(item.assetDescription)}</strong></td>
      <td>${escapeHtml(item.gearType)}</td>
      <td>${escapeHtml(item.manufacturer || '—')}</td>
      <td>${escapeHtml(item.serialNumber || item.id)}</td>
      <td>${escapeHtml(item.assignedTo)}</td>
      <td>${escapeHtml(item.currentLocation)}</td>
      <td>${escapeHtml(item.locationType)}</td>
      <td>${formatDate(item.nextMaintenanceDate)}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(item.status)}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10">No turnout gear is due for maintenance within this period.</td></tr>';
}

function renderForecast(rows) {
  const max = Math.max(1, ...rows.flatMap(row => [row.coats, row.pants, row.other]));
  forecastEl.innerHTML = rows.map(row => `<div class="forecast-row">
    <strong>${row.year}</strong>
    <div class="bars" title="Coats ${row.coats}, Pants ${row.pants}, Other ${row.other}">
      <div class="bar" style="height:${Math.max(3, row.coats / max * 44)}px;width:${Math.max(12, row.coats * 5)}px"></div>
      <div class="bar pants" style="height:${Math.max(3, row.pants / max * 44)}px;width:${Math.max(12, row.pants * 5)}px"></div>
      <div class="bar other" style="height:${Math.max(3, row.other / max * 44)}px;width:${Math.max(12, row.other * 5)}px"></div>
      <span>${row.coats} coats · ${row.pants} pants · ${row.other} other</span>
    </div>
  </div>`).join('');
}

function renderLocationSummary(items) {
  const counts = items.reduce((map, item) => map.set(item.locationType, (map.get(item.locationType) || 0) + 1), new Map());
  const order = ['Issued to Member', 'Warehouse', 'Station', 'Unassigned'];
  locationSummaryEl.innerHTML = order.map(type => `<div class="location-card"><span>${type}</span><strong>${counts.get(type) || 0}</strong></div>`).join('');
}

async function loadDashboard() {
  refreshButton.disabled = true;
  syncTextEl.textContent = 'Loading OperativeIQ data…';
  try {
    const response = await fetch('/api/dashboard');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to load dashboard');
    renderMetrics(payload.metrics);
    renderMaintenance(payload.maintenanceDue);
    renderForecast(payload.decommissionForecast);
    renderLocationSummary(payload.maintenanceDue);
    syncTextEl.textContent = `Last synchronized ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payload.generatedAt))}`;
  } catch (error) {
    maintenanceRowsEl.innerHTML = `<tr><td colspan="10"><div class="error">${escapeHtml(error.message)}</div></td></tr>`;
    syncTextEl.textContent = 'OperativeIQ synchronization failed';
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadDashboard);
loadDashboard();
