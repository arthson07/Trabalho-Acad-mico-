const serverLimits = {
	count: 4,
	diskPerServerGB: 10,
	maxDiskGB: 40
};
const chartColors = { green: '#c6f36b', mint: '#67d6ae', muted: '#7d8a81', grid: 'rgba(134, 150, 139, .13)' };
const performancePeriods = { 1: 60 * 60 * 1000, 6: 6 * 60 * 60 * 1000, 24: 24 * 60 * 60 * 1000 };
const performanceHistory = [];
const performanceChartOptions = {
	maintainAspectRatio: false,
	interaction: { intersect: false, mode: 'index' },
	plugins: {
		legend: { display: false },
		tooltip: {
			backgroundColor: '#222c26',
			borderColor: '#39463d',
			borderWidth: 1,
			titleFont: { family: 'DM Mono', size: 10 },
			bodyFont: { family: 'DM Mono', size: 10 },
			padding: 10,
			callbacks: {
				label: context => ` ${context.dataset.label}: ${context.parsed.y}%`
			}
		}
	},
	scales: {
		x: {
			grid: { display: false },
			border: { display: false },
			ticks: {
				color: chartColors.muted,
				font: { family: 'DM Mono', size: 9 },
				maxRotation: 0,
				autoSkip: true,
				maxTicksLimit: 7
			}
		},
		y: {
			min: 0,
			max: 100,
			border: { display: false, dash: [3, 4] },
			grid: { color: chartColors.grid, drawTicks: false },
			ticks: {
				stepSize: 25,
				padding: 9,
				color: chartColors.muted,
				font: { family: 'DM Mono', size: 9 },
				callback: value => `${value}%`
			}
		}
	}
};
const performanceChart = new Chart(document.getElementById('performanceChart'), {
	type: 'line',
	data: { labels: [], datasets: [
		{
			label: 'CPU',
			data: [],
			borderColor: chartColors.green,
			backgroundColor: 'rgba(198,243,107,.08)',
			borderWidth: 2,
			pointRadius: 0,
			pointHoverRadius: 4,
			fill: true,
			tension: .38
		},
		{
			label: 'Memoria RAM',
			data: [],
			borderColor: chartColors.mint,
			backgroundColor: 'transparent',
			borderWidth: 1.7,
			pointRadius: 0,
			pointHoverRadius: 4,
			fill: false,
			tension: .38
		}
	] },
	options: performanceChartOptions
});
const storageChartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	cutout: '82%',
	plugins: {
		legend: { display: false },
		tooltip: {
			backgroundColor: '#222c26',
			borderColor: '#39463d',
			borderWidth: 1,
			titleFont: { family: 'DM Mono', size: 10 },
			bodyFont: { family: 'DM Mono', size: 10 },
			callbacks: {
				label: context => ` ${context.label}: ${context.raw}%`
			}
		}
	}
};
const storageChart = new Chart(document.getElementById('storageChart'), {
	type: 'doughnut',
	data: {
		labels: ['Utilizado', 'Disponivel'],
		datasets: [{
			data: [],
			backgroundColor: [chartColors.green, '#344139'],
			borderWidth: 0,
			hoverOffset: 3,
			spacing: 3,
			borderRadius: 3
		}]
	},
	options: storageChartOptions
});
const formatCapacity = value => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
const setStoragePending = (usedCapacity, reportedCapacity) => {
	const storageCard = document.getElementById('storage');
	const storageAlert = document.getElementById('storageAlert');
	storageCard.dataset.storageStatus = 'unknown';
	storageAlert.hidden = true;
	document.getElementById('storagePercentage').textContent = '—';
	document.getElementById('storageStatus').textContent = reportedCapacity !== null ? 'Aguardando sinal dos 4 servidores' : 'Aguardando telemetria';
	document.getElementById('storageUsed').textContent = usedCapacity === null ? '—' : `${formatCapacity(usedCapacity)} (reportado)`;
	document.getElementById('storageAvailable').textContent = '—';
	document.getElementById('storageCapacity').textContent = reportedCapacity === null
		? '— / 40 GB max.'
		: `${formatCapacity(reportedCapacity)} / 40 GB max.`;
	storageChart.data.datasets[0].data = [];
	storageChart.update();
};
const updateStorageUsage = (usedCapacity, totalCapacity) => {
	if (!Number.isFinite(usedCapacity) || !Number.isFinite(totalCapacity) || usedCapacity < 0 ||
		totalCapacity <= 0 || totalCapacity > serverLimits.maxDiskGB || usedCapacity > totalCapacity) {
		throw new RangeError('Uso e capacidade do disco devem estar entre zero e 40 GB, e o uso nao pode exceder a capacidade medida.');
	}

	const usagePercent = (usedCapacity / totalCapacity) * 100;
	const storageStatus = usagePercent > 85
		? { level: 'critical', color: '#f17b72', label: 'Critico: acima de 85%' }
		: usagePercent >= 70
			? { level: 'warning', color: '#f2bb65', label: 'Atencao: 70% ou mais' }
			: { level: 'normal', color: chartColors.green, label: 'Normal' };
	const storageCard = document.getElementById('storage');
	const storageAlert = document.getElementById('storageAlert');

	storageCard.dataset.storageStatus = storageStatus.level;
	storageAlert.hidden = storageStatus.level === 'normal';
	storageAlert.setAttribute('aria-label', storageStatus.label);
	storageAlert.title = storageStatus.label;
	document.getElementById('storagePercentage').textContent = `${usagePercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
	document.getElementById('storageStatus').textContent = storageStatus.label;
	document.getElementById('storageUsed').textContent = formatCapacity(usedCapacity);
	document.getElementById('storageAvailable').textContent = formatCapacity(totalCapacity - usedCapacity);
	document.getElementById('storageCapacity').textContent = `${formatCapacity(totalCapacity)} / 40 GB max.`;
	storageChart.data.datasets[0].data = [usagePercent, 100 - usagePercent];
	storageChart.data.datasets[0].backgroundColor = [storageStatus.color, '#344139'];
	storageChart.update();
};
window.updateStorageUsage = updateStorageUsage;

let liveDataActive = false;
const monitoringService = new ServerMonitoringService({
	onAlert: alert => window.dispatchEvent(new CustomEvent('monitoring-alert', { detail: alert }))
});
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const getServerStatus = server => server.offline
	? 'Offline'
	: [server.cpu, server.memory, server.disk].some(value => value > 85)
		? 'Instavel'
		: 'Online';
const getLiveScenario = () => {
	const monitoredServers = monitoringService.getServers();
	const onlineServers = monitoredServers.filter(server => !server.offline);
	const average = metric => onlineServers.length
		? onlineServers.reduce((total, server) => total + server[metric], 0) / onlineServers.length
		: null;
	const alerts = monitoringService.getAlerts().slice(0, 10).map(alert => {
		const elapsedMinutes = Math.floor((Date.now() - alert.createdAt) / 60000);
		return {
			level: alert.level,
			icon: alert.level === 'resolved' ? 'icon-check' : alert.icon || 'icon-server-offline',
			title: alert.title,
			detail: alert.detail,
			time: elapsedMinutes < 1 ? 'agora' : `${elapsedMinutes} min`
		};
	});

	return {
		monitoredServers,
		onlineServers,
		cpu: average('cpu'),
		memory: average('memory'),
		storageUsed: monitoredServers.reduce((total, server) => total + server.diskUsed, 0),
		storageCapacity: monitoredServers.reduce((total, server) => total + server.diskTotal, 0),
		alerts,
		activeAlertCount: monitoringService.getActiveAlertCount()
	};
};
const updatePerformanceChart = () => {
	const period = document.querySelector('.period-btn.active')?.dataset.period || '6';
	const cutoff = Date.now() - performancePeriods[period];
	const records = performanceHistory.filter(record => record.time >= cutoff);
	performanceChart.data.labels = records.map(record => record.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
	performanceChart.data.datasets[0].data = records.map(record => record.cpu);
	performanceChart.data.datasets[1].data = records.map(record => record.memory);
	performanceChart.update();
};
document.querySelectorAll('.period-btn').forEach(button => button.addEventListener('click', () => {
	document.querySelectorAll('.period-btn').forEach(item => item.classList.toggle('active', item === button));
	updatePerformanceChart();
}));
const renderMetric = (id, value, unit = '') => {
	const node = document.getElementById(id);
	if (node) node.innerHTML = `${escapeHtml(value)}${unit ? `<span class="metric-unit">${escapeHtml(unit)}</span>` : ''}`;
};
const renderAlertList = (selector, alerts) => {
	const container = document.querySelector(selector);
	if (!container) return;
	if (!alerts.length) {
		container.innerHTML = '<p class="empty-state">Nenhum alerta recebido. Aguardando telemetria dos servidores.</p>';
		return;
	}
	container.innerHTML = alerts.map(alert => {
		const alertClass = alert.level === 'critical' ? 'critical' : alert.level === 'warning' ? 'warning' : 'resolved';
		return `<div class="alert"><span class="alert-icon ${alertClass}"><svg aria-hidden="true"><use href="#${escapeHtml(alert.icon)}"/></svg></span><div><div class="alert-title">${escapeHtml(alert.title)}</div><div class="alert-detail">${escapeHtml(alert.detail)}</div></div><span class="alert-time"><svg aria-hidden="true"><use href="#icon-clock"/></svg>${escapeHtml(alert.time)}</span></div>`;
	}).join('');
};
const renderDialogAlerts = (alerts, activeCount) => {
	const alertCopy = document.querySelector('#alertsDialog .dialog-header p');
	if (alertCopy) alertCopy.textContent = `${activeCount} eventos aguardam atencao`;
	['#notificationsDialog .dialog-list', '#alertsDialog .dialog-list'].forEach(selector => renderAlertList(selector, alerts));
	const topAlertLink = document.querySelector('.topbar-alert-link');
	if (topAlertLink) {
		const badge = topAlertLink.querySelector('.nav-count');
		if (badge) badge.textContent = String(activeCount).padStart(2, '0');
		topAlertLink.setAttribute('aria-label', `Abrir alertas: ${activeCount} ativos`);
	}
	const alertViewButton = document.querySelector('#alerts .view-all');
	if (alertViewButton) alertViewButton.textContent = `${String(activeCount).padStart(2, '0')} ATIVOS`;
	const sidebarAlertLink = document.querySelector('.sidebar-link[href="#alerts"]');
	if (sidebarAlertLink) {
		const badge = sidebarAlertLink.querySelector('.nav-count');
		if (badge) badge.textContent = String(activeCount).padStart(2, '0');
		sidebarAlertLink.setAttribute('aria-label', `Alertas, ${activeCount} ativos`);
	}
	renderMetric('alertsMetric', activeCount);
};
const renderServers = (servers) => {
	const rows = servers.map(server => {
		const status = getServerStatus(server);
		const statusClass = status === 'Offline' ? 'offline' : status === 'Instavel' ? 'warning' : 'online';
		const statusIcon = status === 'Offline' ? 'icon-server-offline' : status === 'Instavel' ? 'icon-alert' : 'icon-check-circle';
		const usageClass = server.cpu >= 80 ? 'bad' : server.cpu >= 65 ? 'warn' : '';
		return `<tr><td><span class="server-name"><span class="status-dot ${statusClass === 'online' ? '' : statusClass}"></span>${escapeHtml(server.serverId)}</span></td><td><span class="table-status ${statusClass}"><svg aria-hidden="true"><use href="#${statusIcon}"/></svg>${status}</span></td><td><span class="usage"><span class="usage-track"><span class="usage-fill ${usageClass}" style="width:${server.cpu}%"></span></span><span class="mono">${Math.round(server.cpu)}%</span></span></td><td class="mono">${Math.round(server.memory)}%</td><td class="mono">${Math.round(server.disk)}%</td></tr>`;
	}).join('');
	const tableBody = document.querySelector('#servers tbody');
	if (tableBody) tableBody.innerHTML = rows || '<tr><td class="empty-state" colspan="5">Nenhum servidor enviou telemetria nesta sessao.</td></tr>';

	const dialogList = document.getElementById('allServersList');
	if (!dialogList) return;
	dialogList.innerHTML = '';
	const header = document.createElement('div');
	header.className = 'dialog-server header';
	header.innerHTML = '<span><svg class="table-icon" aria-hidden="true"><use href="#icon-server"/></svg>Servidor</span><span><svg class="table-icon" aria-hidden="true"><use href="#icon-check-circle"/></svg>Status</span><span><svg class="table-icon" aria-hidden="true"><use href="#icon-cpu"/></svg>CPU</span><span><svg class="table-icon" aria-hidden="true"><use href="#icon-memory"/></svg>RAM</span><span><svg class="table-icon" aria-hidden="true"><use href="#icon-storage"/></svg>Disco</span>';
	dialogList.append(header);
	if (!servers.length) {
		const empty = document.createElement('p');
		empty.className = 'empty-state';
		empty.textContent = 'Nenhum servidor enviou telemetria nesta sessao.';
		dialogList.append(empty);
		return;
	}
	servers.forEach(server => {
		const row = document.createElement('div');
		row.className = 'dialog-server';
		const status = getServerStatus(server);
		const statusClass = status === 'Offline' ? 'offline' : status === 'Instavel' ? 'warning' : 'online';
		const statusIcon = status === 'Offline' ? 'icon-server-offline' : status === 'Instavel' ? 'icon-alert' : 'icon-check-circle';
		row.innerHTML = `<span class="server-name"><span class="status-dot ${statusClass === 'online' ? '' : statusClass}"></span>${escapeHtml(server.serverId)}</span><span class="dialog-status ${statusClass}"><svg aria-hidden="true"><use href="#${statusIcon}"/></svg>${status}</span><span class="mono">${Math.round(server.cpu)}%</span><span class="mono">${Math.round(server.memory)}%</span><span class="mono">${Math.round(server.disk)}%</span>`;
		dialogList.append(row);
	});
};
const refreshLiveStatus = scenario => {
	const pill = document.querySelector('.live-pill');
	const notice = document.querySelector('.data-notice');
	if (pill) {
		if (scenario.onlineServers.length) {
			pill.classList.remove('waiting', 'offline');
			pill.lastChild.textContent = 'MONITORAMENTO AO VIVO';
		} else {
			pill.classList.remove('waiting');
			pill.classList.add('offline');
			pill.lastChild.textContent = 'SEM SINAL DE TELEMETRIA';
		}
	}
	if (notice) notice.textContent = scenario.onlineServers.length
		? 'Telemetria recebida pela integracao; valores mostram as ultimas leituras dos servidores.'
		: 'Sem servidores enviando dados recentes; os ultimos valores podem estar desatualizados.';
};
const refreshDashboard = () => {
	const scenario = getLiveScenario();
	const onlineCount = scenario.onlineServers.length;
	const missingSignalCount = serverLimits.count - onlineCount;
	renderMetric('cpuMetric', scenario.cpu === null ? '—' : Math.round(scenario.cpu), scenario.cpu === null ? '' : '%');
	renderMetric('onlineMetric', onlineCount, ` / ${serverLimits.count}`);
	renderMetric('offlineMetric', missingSignalCount);
	renderMetric('memoryMetric', scenario.memory === null ? '—' : Math.round(scenario.memory), scenario.memory === null ? '' : '%');

	const latestReading = Math.max(...scenario.monitoredServers.map(server => server.lastSeenAt), 0);
	document.getElementById('updatedAt').textContent = latestReading
		? `ULTIMA LEITURA · ${new Date(latestReading).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
		: 'AGUARDANDO DADOS';
	document.getElementById('serversDialogSummary').textContent = `${onlineCount} de ${serverLimits.count} servidores com sinal · DC Sao Paulo 01`;
	renderServers(scenario.monitoredServers);
	renderAlertList('#alerts .alert-list', scenario.alerts);
	renderDialogAlerts(scenario.alerts, scenario.activeAlertCount);
	updatePerformanceChart();

	if (!scenario.monitoredServers.length) {
		setStoragePending(null, null);
	} else if (scenario.monitoredServers.length !== serverLimits.count || onlineCount !== serverLimits.count) {
		const reportedCapacity = scenario.monitoredServers.length === serverLimits.count
			? scenario.storageCapacity
			: null;
		setStoragePending(scenario.storageUsed, reportedCapacity);
	} else {
		updateStorageUsage(scenario.storageUsed, scenario.storageCapacity);
	}
	if (liveDataActive) refreshLiveStatus(scenario);
};
window.receiveServerTelemetry = telemetry => {
	if (!telemetry || typeof telemetry !== 'object') {
		throw new TypeError('A telemetria precisa ser enviada como um objeto.');
	}
	const serverId = typeof telemetry.serverId === 'string' ? telemetry.serverId.trim() : '';
	const knownServers = monitoringService.getServers();
	if (!knownServers.some(server => server.serverId === serverId) && knownServers.length >= serverLimits.count) {
		throw new RangeError('O inventario aceita telemetria de no maximo 4 servidores.');
	}
	if (!Number.isFinite(telemetry.diskTotal) || telemetry.diskTotal <= 0 || telemetry.diskTotal > serverLimits.diskPerServerGB) {
		throw new RangeError('diskTotal deve ser informado em GB e nao pode exceder 10 GB por servidor.');
	}

	const server = monitoringService.ingest(telemetry);
	liveDataActive = true;
	const current = getLiveScenario();
	if (current.onlineServers.length) {
		performanceHistory.push({ time: new Date(), cpu: current.cpu, memory: current.memory });
		if (performanceHistory.length > 2000) performanceHistory.shift();
	}
	refreshDashboard();
	return server;
};

const serverList = document.getElementById('allServersList');
if (serverList) {
	[...serverList.querySelectorAll('.dialog-server')].forEach(node => node.remove());
}
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
	document.getElementById(button.dataset.dialog).showModal();
}));
document.getElementById('notificationsButton').addEventListener('click', () => document.getElementById('notificationsDialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
	if (event.target === dialog) dialog.close();
}));
setInterval(() => {
	if (liveDataActive && monitoringService.checkOffline()) refreshDashboard();
}, 5000);
refreshDashboard();

const navigationLinks = document.querySelectorAll('.sidebar-link, .topbar-alert-link');
const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
sidebarCollapseToggle.addEventListener('click', () => {
	const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
	const label = isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral';
	sidebarCollapseToggle.setAttribute('aria-pressed', String(isCollapsed));
	sidebarCollapseToggle.setAttribute('aria-label', label);
	sidebarCollapseToggle.title = label;
});
document.querySelectorAll('.sidebar-link').forEach(link => link.addEventListener('click', () => {
	if (window.matchMedia('(max-width: 991.98px)').matches) {
		bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('primarySidebar')).hide();
	}
}));
const pageViews = {
	overview: { title: 'Visao geral', subtitle: 'Acompanhe a saude e o desempenho da sua infraestrutura.' },
	servers: { title: 'Servidores', subtitle: 'Estado e uso dos servidores que enviam telemetria.' },
	storage: { title: 'Armazenamento', subtitle: 'Uso medido e capacidade planejada do data center.' },
	alerts: { title: 'Alertas', subtitle: 'Eventos identificados a partir da telemetria recebida.' }
};
const updateActiveNavigation = () => {
	const requestedView = window.location.hash.slice(1);
	const activeView = Object.hasOwn(pageViews, requestedView) ? requestedView : 'overview';
	const page = pageViews[activeView];
	document.body.dataset.view = activeView;
	document.getElementById('currentTitle').textContent = page.title;
	document.getElementById('currentBreadcrumb').textContent = page.title;
	document.getElementById('currentSubtitle').textContent = page.subtitle;
	navigationLinks.forEach(link => {
		const isActive = link.hash === `#${activeView}`;
		link.classList.toggle('active', isActive);
		if (isActive) link.setAttribute('aria-current', 'page');
		else link.removeAttribute('aria-current');
	});
	window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.addEventListener('hashchange', updateActiveNavigation);
updateActiveNavigation();
