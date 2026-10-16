const serverLimits = {
	count: 4,
	diskPerServerGB: 10,
	maxDiskGB: 40
};
// Define os limites máximos de servidores e de capacidade de armazenamento permitidos.

const chartColors = { green: '#c6f36b', mint: '#67d6ae', muted: '#7d8a81', grid: 'rgba(134, 150, 139, .13)' };
// Define a paleta de cores padrão utilizada na estilização dos gráficos.

const performancePeriods = { 1: 60 * 60 * 1000, 6: 6 * 60 * 60 * 1000, 24: 24 * 60 * 60 * 1000 };
// Mapeia os períodos de tempo em milissegundos para análise do desempenho.

const performanceHistory = [];
// Inicializa o array que armazenará os registros históricos de desempenho (CPU e memória).

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
// Configura as opções de exibição, tooltips, fontes e eixos do gráfico de desempenho.

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
// Instancia o gráfico de desempenho (linha) no elemento do DOM com as configurações e datasets de CPU e Memória RAM.

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
// Configura as opções de layout, responsividade e tooltips para o gráfico de armazenamento.

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
// Instancia o gráfico de armazenamento no formato doughnut (rosca) utilizando as opções definidas.

const formatCapacity = value => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
// Função utilitária para formatar a exibição dos valores de capacidade em GB.

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
// Gerencia e atualiza a interface com o estado pendente do armazenamento e limpa o gráfico correspondente.

const updateStorageUsage = (usedCapacity, totalCapacity) => {
	if (!Number.isFinite(usedCapacity) || !Number.isFinite(totalCapacity) || usedCapacity < 0 ||
		totalCapacity <= 0 || totalCapacity > serverLimits.maxDiskGB || usedCapacity > totalCapacity) {
		throw new RangeError('Uso e capacidade do disco devem estar entre zero e 40 GB, e o uso nao pode exceder a capacidade medida.');
	}
	// Valida se os valores de capacidade utilizada e total são números válidos e respeitam os limites de armazenamento.

	const usagePercent = (usedCapacity / totalCapacity) * 100;
	const storageStatus = usagePercent > 85
		? { level: 'critical', color: '#f17b72', label: 'Critico: acima de 85%' }
		: usagePercent >= 70
			? { level: 'warning', color: '#f2bb65', label: 'Atencao: 70% ou mais' }
			: { level: 'normal', color: chartColors.green, label: 'Normal' };
	// Calcula a porcentagem de uso do disco e determina o nível de status (crítico, atenção ou normal).

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
	// Atualiza os elementos visuais do cartão de armazenamento, mensagens de alerta, textos do DOM e os dados do gráfico de rosca.
};

window.updateStorageUsage = updateStorageUsage;
// Expõe a função de atualização do uso de armazenamento no objeto global window.

let liveDataActive = false;
const monitoringService = new ServerMonitoringService({
	onAlert: alert => window.dispatchEvent(new CustomEvent('monitoring-alert', { detail: alert }))
});
// Inicializa a flag de controle ao vivo e instancia o serviço de monitoramento de servidores com tratamento de eventos de alerta.

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
// Função utilitária para escapar caracteres especiais e prevenir problemas de segurança em HTML.

const getServerStatus = server => server.offline
	? 'Offline'
	: [server.cpu, server.memory, server.disk].some(value => value > 85)
		? 'Instavel'
		: 'Online';
		// Determina o status operacional do servidor com base na conectividade e em limites críticos de métricas.

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
// Coleta, calcula e retorna o cenário atual consolidado da infraestrutura, incluindo servidores, médias de desempenho, uso de armazenamento e alertas formatados.

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
// Atualiza os dados do gráfico de desempenho com base no período selecionado e configura os ouvintes de clique nos botões de período.

const renderMetric = (id, value, unit = '') => {
	const node = document.getElementById(id);
	if (node) node.innerHTML = `${escapeHtml(value)}${unit ? `<span class="metric-unit">${escapeHtml(unit)}</span>` : ''}`;
};
// Função utilitária para renderizar os valores e unidades das métricas na interface.

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
// Renderiza a lista de alertas em um container específico ou exibe o estado vazio caso não haja alertas.

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
// Atualiza os modais de alertas/notificações, contadores, badges na barra superior e lateral, e a métrica geral de alertas.

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
// Renderiza a tabela principal de servidores na interface e popula a lista detalhada dentro do modal correspondente.

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
// Atualiza o indicador de monitoramento e a mensagem informativa conforme a disponibilidade dos servidores.

const refreshDashboard = () => {
	const scenario = getLiveScenario();
	const onlineCount = scenario.onlineServers.length;
	const missingSignalCount = serverLimits.count - onlineCount;
	// Obtém o cenário atual e calcula a contagem de servidores online e ausentes.

	renderMetric('cpuMetric', scenario.cpu === null ? '—' : Math.round(scenario.cpu), scenario.cpu === null ? '' : '%');
	renderMetric('onlineMetric', onlineCount, ` / ${serverLimits.count}`);
	renderMetric('offlineMetric', missingSignalCount);
	renderMetric('memoryMetric', scenario.memory === null ? '—' : Math.round(scenario.memory), scenario.memory === null ? '' : '%');
	// Atualiza os componentes visuais das métricas principais de desempenho.


	const latestReading = Math.max(...scenario.monitoredServers.map(server => server.lastSeenAt), 0);
	document.getElementById('updatedAt').textContent = latestReading
		? `ULTIMA LEITURA · ${new Date(latestReading).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
		: 'AGUARDANDO DADOS';
	document.getElementById('serversDialogSummary').textContent = `${onlineCount} de ${serverLimits.count} servidores com sinal · DC Sao Paulo 01`;
	renderServers(scenario.monitoredServers);
	renderAlertList('#alerts .alert-list', scenario.alerts);
	renderDialogAlerts(scenario.alerts, scenario.activeAlertCount);
	updatePerformanceChart();
	// Atualiza o timestamp da última leitura, o resumo do diálogo, a lista de servidores, os alertas e o gráfico de desempenho.

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
	// Gerencia o estado de pendência ou o uso atual do armazenamento com base na quantidade de servidores ativos.

	if (liveDataActive) refreshLiveStatus(scenario);
	// Atualiza o status em tempo real caso o modo ao vivo esteja ativo.
};
window.receiveServerTelemetry = telemetry => { 
	if (!telemetry || typeof telemetry !== 'object') {
		throw new TypeError('A telemetria precisa ser enviada como um objeto.');
	}
	// Valida se os dados de telemetria foram enviados em um formato de objeto válido.

	const serverId = typeof telemetry.serverId === 'string' ? telemetry.serverId.trim() : '';
	const knownServers = monitoringService.getServers();
	if (!knownServers.some(server => server.serverId === serverId) && knownServers.length >= serverLimits.count) {
		throw new RangeError('O inventario aceita telemetria de no maximo 4 servidores.');
	}
	// Valida o ID do servidor e verifica se o inventário excedeu o limite máximo de servidores.

	if (!Number.isFinite(telemetry.diskTotal) || telemetry.diskTotal <= 0 || telemetry.diskTotal > serverLimits.diskPerServerGB) {
		throw new RangeError('diskTotal deve ser informado em GB e nao pode exceder 10 GB por servidor.');
	}
	// Valida se o espaço total em disco está dentro dos limites permitidos por servidor.

	const server = monitoringService.ingest(telemetry);
	liveDataActive = true;
	const current = getLiveScenario();
	if (current.onlineServers.length) {
		performanceHistory.push({ time: new Date(), cpu: current.cpu, memory: current.memory });
		if (performanceHistory.length > 2000) performanceHistory.shift();
	}
	refreshDashboard();
	return server;
	// Processa a telemetria, atualiza o histórico de desempenho, atualiza o painel e retorna o objeto do servidor.

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
// Limpa a lista de servidores, configura eventos de abertura/fechamento de diálogos, define a verificação periódica de inatividade e inicializa o painel.


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
// Configura o botão de recolher/expandir a barra lateral e o fechamento automático do menu offcanvas em dispositivos móveis.

const pageViews = {
	overview: { title: 'Visao geral', subtitle: 'Acompanhe a saude e o desempenho da sua infraestrutura.' },
	servers: { title: 'Servidores', subtitle: 'Estado e uso dos servidores que enviam telemetria.' },
	storage: { title: 'Armazenamento', subtitle: 'Uso medido e capacidade planejada do data center.' },
	alerts: { title: 'Alertas', subtitle: 'Eventos identificados a partir da telemetria recebida.' }
};
// Armazena os títulos e subtítulos correspondentes a cada visualização de página do sistema.

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
// Gerencia a navegação ativa atualizando cabeçalhos, estado visual dos links, acessibilidade e rolando a página para o topo.

window.addEventListener('hashchange', updateActiveNavigation);
updateActiveNavigation();
// Configura o ouvinte para alterações de hash na URL e inicializa o estado de navegação da página.

// Cole este bloco no final do arquivo app.js ou monitoring.js
window.addEventListener('DOMContentLoaded', () => {
    try {
        window.receiveServerTelemetry({
            serverId: "SRV-TEST-01",
            diskTotal: 8,
			diskUsed: 4,
            cpu: 55.0,
            memory: 70.0,
            status: "online"
        });
        console.log("Telemetria de teste injetada com sucesso!");
    } catch (error) {
        console.error("Erro ao injetar telemetria de teste:", error.message);
    }
});
// Aguarda o carregamento completo do DOM para injetar dados de telemetria de teste inicial com tratamento de erros.
