(function (root) {
	'use strict';

	const ALERT_THRESHOLD = 85;
	const DEFAULT_OFFLINE_AFTER_MS = 2 * 60 * 1000;
	const MAX_ALERT_HISTORY = 100;

	class ServerMonitoringService {
		constructor({ onAlert = () => {}, now = Date.now, offlineAfterMs = DEFAULT_OFFLINE_AFTER_MS } = {}) {
			if (typeof onAlert !== 'function' || typeof now !== 'function') {
				throw new TypeError('onAlert e now precisam ser funcoes.');
			}
			if (!Number.isFinite(offlineAfterMs) || offlineAfterMs <= 0) {
				throw new RangeError('offlineAfterMs precisa ser maior que zero.');
			}

			this.onAlert = onAlert;
			this.now = now;
			this.offlineAfterMs = offlineAfterMs;
			this.servers = new Map();
			this.alerts = [];
			this.activeAlerts = new Map();
		}

		ingest({ serverId, cpu, memory, diskUsed, diskTotal } = {}) {
			if (typeof serverId !== 'string' || !serverId.trim() || serverId.length > 128) {
				throw new TypeError('serverId precisa ser um texto entre 1 e 128 caracteres.');
			}
			if (![cpu, memory].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
				throw new RangeError('CPU e memoria precisam estar entre 0 e 100%.');
			}
			if (!Number.isFinite(diskUsed) || !Number.isFinite(diskTotal) ||
				diskUsed < 0 || diskTotal <= 0 || diskUsed > diskTotal) {
				throw new RangeError('O uso do disco precisa estar entre zero e a capacidade total.');
			}

			const id = serverId.trim();
			const receivedAt = this.now();
			const server = {
				serverId: id,
				cpu,
				memory,
				diskUsed,
				diskTotal,
				disk: (diskUsed / diskTotal) * 100,
				lastSeenAt: receivedAt,
				offline: false
			};
			this.servers.set(id, server);
			this.updateThresholdAlert(id, 'cpu', cpu);
			this.updateThresholdAlert(id, 'memory', memory);
			this.updateThresholdAlert(id, 'disk', server.disk);
			this.resolveAlert(`offline:${id}`);
			return { ...server };
		}

		checkOffline(at = this.now()) {
			if (!Number.isFinite(at)) throw new TypeError('O horario de verificacao precisa ser numerico.');
			let changed = false;
			for (const server of this.servers.values()) {
				if (!server.offline && at - server.lastSeenAt > this.offlineAfterMs) {
					server.offline = true;
					this.createAlert({
						key: `offline:${server.serverId}`,
						level: 'critical',
						type: 'offline',
						serverId: server.serverId,
						title: 'Servidor OFFLINE (CRITICO)',
						detail: `${server.serverId} esta sem enviar dados ha mais de 2 minutos.`
					});
					changed = true;
				}
			}
			return changed;
		}

		getServers() {
			return [...this.servers.values()].map(server => ({ ...server }));
		}

		getAlerts() {
			return this.alerts.map(alert => ({ ...alert }));
		}

		getActiveAlertCount() {
			return this.activeAlerts.size;
		}

		updateThresholdAlert(serverId, metric, value) {
			const key = `${metric}:${serverId}`;
			if (value > ALERT_THRESHOLD) {
				const labels = {
					cpu: ['CPU acima de 85%', 'icon-cpu'],
					memory: ['Memoria acima de 85%', 'icon-memory'],
					disk: ['Disco acima de 85%', 'icon-storage']
				};
				this.createAlert({
					key,
					level: 'critical',
					type: metric,
					serverId,
					title: labels[metric][0],
					detail: `${serverId} esta usando ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de ${metric === 'memory' ? 'memoria' : metric === 'disk' ? 'disco' : 'CPU'}.`,
					icon: labels[metric][1]
				});
			} else {
				this.resolveAlert(key);
			}
		}

		createAlert(alert) {
			if (this.activeAlerts.has(alert.key)) return;
			const entry = { ...alert, createdAt: this.now(), resolvedAt: null };
			this.activeAlerts.set(alert.key, entry);
			this.alerts.unshift(entry);
			this.trimAlertHistory();
			this.onAlert({ ...entry });
		}

		trimAlertHistory() {
			let resolvedCount = this.alerts.filter(alert => alert.level === 'resolved').length;
			for (let index = this.alerts.length - 1; resolvedCount > MAX_ALERT_HISTORY && index >= 0; index -= 1) {
				if (this.alerts[index].level === 'resolved') {
					this.alerts.splice(index, 1);
					resolvedCount -= 1;
				}
			}
		}

		resolveAlert(key) {
			const alert = this.activeAlerts.get(key);
			if (!alert) return;
			this.activeAlerts.delete(key);
			alert.level = 'resolved';
			alert.resolvedAt = this.now();
			alert.title = alert.type === 'offline' ? 'Servidor recuperado' : 'Alerta resolvido';
			alert.detail = `${alert.serverId} voltou a ficar dentro do limite.`;
			this.alerts.splice(this.alerts.indexOf(alert), 1);
			this.alerts.unshift(alert);
			this.trimAlertHistory();
			this.onAlert({ ...alert });
		}
	}

	root.ServerMonitoringService = ServerMonitoringService;
})(typeof window === 'undefined' ? globalThis : window);
