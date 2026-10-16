# Pulse — Monitoramento do Data Center

Dashboard web responsivo para visualizar telemetria de CPU, memória, disco, disponibilidade e alertas de até quatro servidores.

## Estrutura

- `index.html`: estrutura da interface, indicadores, gráficos e diálogos.
- `styles.css`: tema visual, estados dos componentes e layout responsivo.
- `app.js`: atualização da interface, gráficos, navegação, validação de limites e integração da telemetria.
- `monitoring.js`: validação das leituras, estado de disponibilidade e ciclo de vida dos alertas.

## Interface

A **Visão geral** mostra indicadores, histórico da sessão, armazenamento medido, servidores e alertas. As telas **Servidores**, **Armazenamento** e **Alertas** podem ser abertas pela navegação lateral. O cartão de capacidade planejada foi removido; não confunda os limites configurados no código com métricas coletadas.

Sem telemetria, as métricas aparecem como indisponíveis. O dashboard não cria dados fictícios. O histórico de CPU/memória e os alertas só existem na memória da página e são perdidos ao recarregá-la.

## Configuração deste projeto

Os limites de entrada correspondem à infraestrutura informada:

- Quatro servidores: três servidores e um servidor central.
- RAM planejada: 5 GB no total (1 GB por servidor e 2 GB no central).
- Disco: no máximo 10 GB por servidor e 40 GB no total.
- CPUs: seis vCPUs no total.

Essa capacidade planejada não é exibida como consumo medido no dashboard. Para alterar limites, atualize a configuração `serverLimits` no início de `app.js` e valide as capacidades reais dos servidores antes de ingerir telemetria.

## Integrar telemetria

O navegador disponibiliza `window.receiveServerTelemetry` para ser chamado por código hospedeiro já integrado ao coletor:

```js
window.receiveServerTelemetry({
  serverId: 'servidor-01',
  cpu: 86.2,       // percentual de 0 a 100
  memory: 78.4,    // percentual de 0 a 100
  diskUsed: 8.6,   // GB
  diskTotal: 10    // GB; no maximo 10 GB por servidor
});
```

CPU, memória e disco geram alerta crítico quando ultrapassam 85%. Um servidor sem nova leitura por mais de dois minutos é marcado offline; a verificação ocorre a cada cinco segundos, após sua primeira leitura. O painel só calcula o percentual de disco quando os quatro servidores enviam dados recentes. A média de CPU/memória é calculada entre servidores com sinal e não pondera RAM alocada.

Cada abertura ou resolução de alerta emite o evento de navegador `monitoring-alert`, com os dados do alerta em `event.detail`.

## Prontidão para uso real

**O dashboard ainda não está apto, sozinho, para monitoramento operacional.** `window.receiveServerTelemetry` é uma função JavaScript local, não um endpoint de rede, coletor ou mecanismo autenticado. A página não conecta aos servidores, não persiste dados, não envia notificações externas e deixa de monitorar quando fechada.

Para produção, é necessário implantar um coletor/backend autenticado e protegido, conectar os quatro servidores, configurar armazenamento persistente e alertas externos, e monitorar o próprio coletor. Não exponha a função do navegador como canal público de ingestão.

## Executar e verificar

Abra `index.html` em um navegador com acesso à internet. Bootstrap e Chart.js são carregados por CDN.

Verifique a sintaxe dos scripts com Node.js:

```powershell
node --check app.js
node --check monitoring.js
```

O teste de uso manual feito nesta alteração cobriu carregamento sem dados simulados, navegação, estado sem telemetria, inventário e notificações, agregação de leituras dos quatro servidores, alertas e recuperação, limite de quatro servidores, máximo de 10 GB por disco e layout mobile. Isso valida o dashboard e a função local de entrada; não substitui o teste de ponta a ponta com o coletor real.

## Repositório e publicação

- Código-fonte: [GitHub](https://github.com/gabrielmartins171223-ship-it/data-center-monitoring-system).
- Dashboard no GitHub Pages: [abrir o dashboard](https://gabrielmartins171223-ship-it.github.io/data-center-monitoring-system/#overview).

O GitHub Pages publica somente os arquivos estáticos e não recebe telemetria. Para publicar alterações, faça push para `main`; o workflow [pages.yml](https://github.com/gabrielmartins171223-ship-it/data-center-monitoring-system/blob/main/.github/workflows/pages.yml) publica a interface automaticamente.