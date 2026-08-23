/* InduGraph AI — All page components */
(function () {
  const {
    e, useState, useEffect, useRef, useMemo,
    formatINR, formatIST, healthColor, routeHash,
    useFetch, useLiveStream,
    PageShell, KPICard, SeverityBadge, StatusBadge, HealthBar,
    LoadingState, EmptyState, ChartBox, LineChart, BarChart, DoughnutChart, DataTable,
    downloadCanvasAsPng, downloadVisNetworkPublication
  } = window.InduGraph;

  // ── Overview ──
  function Overview({ data, shell, onSelectMachine }) {
    const { settings, onUpdateSettings } = shell;
    const { data: analytics, loading } = useFetch('/api/analytics');
    const machines = data.machines || [];
    const kpis = analytics?.kpis || {};
    const healthLabels = useMemo(() => machines.map(m => m.name.split(' ').slice(0, 2).join(' ')), [machines]);
    const healthValues = useMemo(() => machines.map(m => m.health), [machines]);
    const healthColors = useMemo(() => machines.map(m => healthColor(m.health)), [machines]);
    const oeeLabels = useMemo(() => (analytics?.oeeByFactory || []).map(f => f.name), [analytics]);
    const oeeValues = useMemo(() => (analytics?.oeeByFactory || []).map(f => f.oee), [analytics]);

    return e(PageShell, { title: 'Overview', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Fleet Health', value: (kpis.avgHealth || 0) + '%', color: healthColor(kpis.avgHealth || 0), muted: 'Across ' + (kpis.totalFactories || 0) + ' plants' }),
          e(KPICard, { title: 'Active Machines', value: kpis.totalMachines || 0, muted: kpis.degradedMachines + ' degraded' }),
          e(KPICard, { title: 'Plant OEE', value: (kpis.avgOEE || 0) + '%', trend: 2.1, muted: 'Industry avg: 75%' }),
          e(KPICard, { title: 'Open Alerts', value: kpis.openAlerts || 0, color: '#ef4444', muted: kpis.criticalMachines + ' critical machines' }),
          e(KPICard, { title: 'Predicted Failures', value: kpis.predictedFailures7d || 0, color: '#f97316', muted: 'Next 7 days' }),
          e(KPICard, { title: 'Maint. Cost', value: formatINR(kpis.maintenanceCostINR), muted: 'Planned this month' })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'Machine Health by Asset'),
            machines.length > 0 && e(BarChart, {
              labels: healthLabels,
              data: healthValues,
              label: 'Health %',
              color: healthColors.length === 1 ? healthColors[0] : healthColors,
              height: 280,
              yMax: 100,
              downloadName: 'machine-health-by-asset'
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'OEE by Factory'),
            oeeLabels.length > 0 && e(BarChart, {
              labels: oeeLabels,
              data: oeeValues,
              label: 'OEE %',
              color: '#0ea5a4',
              height: 280,
              yMax: 100,
              downloadName: 'oee-by-factory'
            })
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Critical Machines'),
          e(DataTable, {
            columns: [
              { key: 'name', label: 'Machine' },
              { key: 'type', label: 'Type' },
              { key: 'health', label: 'Health', render: r => e(HealthBar, { value: r.health }) },
              { key: 'status', label: 'Status', render: r => e(StatusBadge, { status: r.status }) },
              { key: 'rulDays', label: 'RUL', render: r => r.rulDays + ' days' },
              { key: 'action', label: '', render: r => e('button', { className: 'btn btn-sm', onClick: () => onSelectMachine(r.id) }, 'Inspect') }
            ],
            rows: machines.filter(m => m.health < 80).sort((a, b) => a.health - b.health)
          })
        )
      )
    );
  }

  // ── Factory ──
  function FactoryPage({ data, shell, selectedFactory }) {
    const { settings, onUpdateSettings } = shell;
    const { data: factories, loading } = useFetch('/api/factories');
    const [selected, setSelected] = useState(selectedFactory || null);
    useEffect(() => { if (selectedFactory) setSelected(selectedFactory); }, [selectedFactory]);
    const { data: detail } = useFetch(selected ? '/api/factories/' + selected : null, [selected]);
    return e(PageShell, { title: 'Factory Management', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'factory-grid' },
          (factories || []).map(f => e('div', {
            key: f.id, className: 'factory-card card' + (selected === f.id ? ' selected' : ''),
            onClick: () => setSelected(f.id)
          },
            e('div', { className: 'factory-card-header' },
              e('h3', {}, f.name),
              e(StatusBadge, { status: f.avgHealth >= 80 ? 'operational' : f.avgHealth >= 60 ? 'degraded' : 'critical' })
            ),
            e('div', { className: 'factory-meta' },
              e('div', {}, e('span', { className: 'muted' }, 'Location'), e('div', {}, f.location)),
              e('div', {}, e('span', { className: 'muted' }, 'Manager'), e('div', {}, f.manager)),
              e('div', {}, e('span', { className: 'muted' }, 'Shifts'), e('div', { style: { fontSize: 12 } }, f.shiftPattern))
            ),
            e('div', { className: 'factory-stats' },
              e('div', {}, e('strong', {}, f.oee + '%'), e('div', { className: 'muted' }, 'OEE')),
              e('div', {}, e('strong', {}, f.uptime + '%'), e('div', { className: 'muted' }, 'Uptime')),
              e('div', {}, e('strong', {}, f.machineCount), e('div', { className: 'muted' }, 'Machines')),
              e('div', {}, e('strong', {}, f.openAlerts), e('div', { className: 'muted' }, 'Alerts'))
            ),
            e(HealthBar, { value: f.avgHealth })
          ))
        ),
        selected && detail && e('div', { className: 'card' },
          e('h3', {}, detail.name + ' — Machine Roster'),
          e(DataTable, {
            columns: [
              { key: 'name', label: 'Machine' }, { key: 'type', label: 'Type' }, { key: 'line', label: 'Line' },
              { key: 'health', label: 'Health', render: r => e(HealthBar, { value: r.health }) },
              { key: 'status', label: 'Status', render: r => e(StatusBadge, { status: r.status }) },
              { key: 'rulDays', label: 'RUL', render: r => r.rulDays + ' days' }
            ],
            rows: detail.machines || []
          })
        )
      )
    );
  }

  // ── Machines ──
  function MachinesPage({ data, shell, onSelectMachine, searchQuery }) {
    const [filter, setFilter] = useState({ status: '', factory: '' });
    const machines = useMemo(() => {
      let list = data.machines || [];
      if (filter.status) list = list.filter(m => m.status === filter.status);
      if (filter.factory) list = list.filter(m => m.factoryId === filter.factory);
      if (searchQuery) {
        const t = searchQuery.toLowerCase();
        list = list.filter(m => m.name.toLowerCase().includes(t) || m.id.toLowerCase().includes(t) || (m.type || '').toLowerCase().includes(t));
      }
      return list;
    }, [data.machines, filter, searchQuery]);
    return e(PageShell, { title: 'Machines', org: data.organization, shell },
      e('div', { className: 'toolbar' },
        e('select', { className: 'select', value: filter.status, onChange: ev => setFilter(f => ({ ...f, status: ev.target.value })) },
          e('option', { value: '' }, 'All statuses'), e('option', { value: 'operational' }, 'Operational'), e('option', { value: 'degraded' }, 'Degraded'), e('option', { value: 'critical' }, 'Critical')),
        e('select', { className: 'select', value: filter.factory, onChange: ev => setFilter(f => ({ ...f, factory: ev.target.value })) },
          e('option', { value: '' }, 'All factories'), ...(data.factories || []).map(f => e('option', { key: f.id, value: f.id }, f.name)))
      ),
      e(DataTable, {
        columns: [
          { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' },
          { key: 'factoryId', label: 'Plant' },
          { key: 'health', label: 'Health', render: r => e(HealthBar, { value: r.health }) },
          { key: 'status', label: 'Status', render: r => e(StatusBadge, { status: r.status }) },
          { key: 'rulDays', label: 'RUL', render: r => e('span', { style: { color: r.rulDays <= 7 ? '#ef4444' : 'inherit', fontWeight: r.rulDays <= 7 ? 700 : 400 } }, r.rulDays + 'd') },
          { key: 'anomalyScore', label: 'Anomaly', render: r => Math.round(r.anomalyScore * 100) + '%' },
          { key: 'action', label: '', render: r => e('button', { className: 'btn btn-sm', onClick: () => onSelectMachine(r.id) }, 'Details') }
        ],
        rows: machines
      })
    );
  }

  // ── Machine Detail ──
  function MachineDetail({ id, onBack, data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: m, loading } = useFetch('/api/machines/' + id, [id]);
    const chartLabels = useMemo(() => {
      if (!m?.readings) return [];
      const first = Object.values(m.readings)[0] || [];
      return first.map((_, i) => 'T-' + (first.length - i));
    }, [m]);
    const chartDatasets = useMemo(() => Object.entries(m?.readings || {}).map(([k, v], i) => ({
      label: k, data: v, borderColor: ['#0ea5a4', '#3b82f6', '#f59e0b', '#8b5cf6'][i % 4], fill: false, tension: 0.3
    })), [m]);
    if (loading || !m) return e(PageShell, { title: 'Machine Detail', shell }, e(LoadingState));
    const fault = (m.faults || [])[0];
    const gnn = m.gnnAnalysis || {};
    const ftMeta = fault ? { severity: gnn.severity || 'medium' } : null;
    return e(PageShell, { title: m.name, org: data.organization, shell },
      e('button', { className: 'btn secondary btn-sm', style: { marginBottom: 16 }, onClick: onBack }, '← Back to Machines'),
      e('div', { className: 'detail-grid' },
        e('div', { className: 'card' },
          e('h3', {}, 'Asset Overview'),
          e('div', { className: 'detail-rows' },
            e('div', {}, e('span', { className: 'muted' }, 'ID'), e('strong', {}, m.id)),
            e('div', {}, e('span', { className: 'muted' }, 'Type'), m.type),
            e('div', {}, e('span', { className: 'muted' }, 'Plant'), m.factory?.name || m.factoryId),
            e('div', {}, e('span', { className: 'muted' }, 'Line'), m.line),
            e('div', {}, e('span', { className: 'muted' }, 'Status'), e(StatusBadge, { status: m.status })),
            e('div', {}, e('span', { className: 'muted' }, 'Health'), e(HealthBar, { value: m.health })),
            e('div', {}, e('span', { className: 'muted' }, 'RUL'), m.rulDays + ' days (' + m.rulHours + ' hrs)'),
            e('div', {}, e('span', { className: 'muted' }, 'Cost/hr'), formatINR(m.costPerHourINR))
          )
        ),
        e('div', { className: 'card ai-panel span-2' },
          e('h3', {}, 'GNN Fault Analysis'),
          e('div', { className: 'gnn-detail-grid' },
            e('div', { className: 'gnn-detail-main' },
              fault ? e('div', {},
                e('div', { className: 'ai-score', style: { color: '#ef4444' } }, Math.round(fault.probability * 100) + '%'),
                e('div', { className: 'muted' }, 'Fault: ' + (gnn.failureMode || fault.type.replace(/_/g, ' '))),
                e('div', { className: 'muted' }, 'Confidence: ' + Math.round(fault.confidence * 100) + '%'),
                ftMeta && e(SeverityBadge, { severity: gnn.severity || 'medium' })
              ) : e('div', { className: 'ai-score', style: { color: '#10b981' } }, 'Normal'),
              e('div', { className: 'muted', style: { marginTop: 8 } }, 'Anomaly score: ' + Math.round(m.anomalyScore * 100) + '% · Embedding drift: ' + Math.round((gnn.embeddingDrift || 0) * 100) + '%')
            ),
            e('div', { className: 'gnn-detail-meta' },
              e('div', { className: 'detail-rows compact' },
                e('div', {}, e('span', { className: 'muted' }, 'Model'), gnn.modelVersion || 'InduGraph-GNN v2.1'),
                e('div', {}, e('span', { className: 'muted' }, 'Inference'), (gnn.inferenceLatencyMs || '—') + ' ms'),
                e('div', {}, e('span', { className: 'muted' }, 'Graph'), (gnn.graphNodes || '—') + ' nodes · ' + (gnn.graphEdges || '—') + ' edges'),
                e('div', {}, e('span', { className: 'muted' }, 'MP Layers'), gnn.messagePassingLayers || 4),
                e('div', {}, e('span', { className: 'muted' }, 'Neighbours'), (gnn.neighborMachines || 0) + ' linked machines')
              )
            )
          ),
          (gnn.attentionPath || []).length > 0 && e('div', { className: 'attention-path', style: { marginTop: 12 } },
            e('div', { className: 'muted', style: { fontSize: 12, marginBottom: 6 } }, 'Attention path (highest → lowest)'),
            e('div', { className: 'attention-chips' },
              (gnn.attentionPath || []).flatMap((node, i) =>
                i === 0 ? [e('span', { key: i, className: 'attention-chip' }, node)] :
                [e('span', { key: 'a' + i, className: 'attention-arrow' }, '→'), e('span', { key: i, className: 'attention-chip' }, node)]
              )
            )
          ),
          (gnn.topContributors || []).length > 0 && e('div', { style: { marginTop: 12 } },
            e('div', { className: 'muted', style: { fontSize: 12, marginBottom: 6 } }, 'Top contributing sensors'),
            e('div', { className: 'contributor-list' },
              (gnn.topContributors || []).map((c, i) => e('div', { key: i, className: 'contributor-row' },
                e('span', {}, c.sensor),
                e('strong', {}, c.value + ' ' + c.unit),
                e('span', { className: 'muted' }, 'weight ' + Math.round(c.weight * 100) + '%'),
                c.breached && e(SeverityBadge, { severity: 'critical' })
              ))
            )
          ),
          gnn.recommendedAction && e('div', { className: 'gnn-action-box', style: { marginTop: 12 } },
            e('strong', {}, 'Recommended action: '), gnn.recommendedAction,
            fault && gnn.rulImpactHours > 0 && e('div', { className: 'muted', style: { marginTop: 4 } }, 'Est. RUL impact if unaddressed: −' + gnn.rulImpactHours + ' hrs')
          )
        ),
        e('div', { className: 'card span-2' },
          e('h3', {}, 'Live Sensor Readings'),
          chartLabels.length > 0 && e(LineChart, { labels: chartLabels, datasets: chartDatasets, height: 260, downloadName: 'live-sensor-readings' })
        ),
        e('div', { className: 'card span-2' },
          e('h3', {}, 'Active Sensors'),
          e('div', { className: 'sensor-grid-full' },
            ...(m.sensors || []).map(s => {
              const pct = s.threshold ? Math.min(100, Math.round((s.latest / s.threshold) * 100)) : 0;
              const over = s.threshold && s.latest > s.threshold;
              return e('div', { key: s.id, className: 'sensor-tile' + (over ? ' sensor-tile-alert' : '') },
                e('div', { className: 'muted', style: { fontSize: 11 } }, s.type),
                e('div', { className: 'sensor-val' }, s.latest + ' ' + s.unit),
                s.threshold && e('div', { className: 'sensor-threshold-bar' },
                  e('div', { className: 'sensor-threshold-fill', style: { width: pct + '%', background: over ? '#ef4444' : '#0ea5a4' } })
                ),
                s.threshold && e('div', { className: 'muted', style: { fontSize: 10 } }, 'Limit: ' + s.threshold + ' ' + s.unit),
                over && e(SeverityBadge, { severity: 'critical' })
              );
            })
          )
        )
      )
    );
  }

  // ── Live Monitoring ──
  function LiveMonitoring({ shell, data, onSelectMachine }) {
    const { settings, onUpdateSettings } = shell;
    const live = useLiveStream(true);
    const machines = live?.machines || data.machines || [];
    return e(PageShell, { title: 'Live Monitoring', org: data.organization, shell },
      e('div', { className: 'live-banner' },
        e('span', { className: 'live-dot' }), 'Streaming telemetry · Updated ' + (live ? formatIST(live.timestamp, settings.timezone) : 'connecting...')
      ),
      e('div', { className: 'live-grid' },
        machines.map(m => e('div', { key: m.id, className: 'card live-card' },
          e('div', { className: 'live-card-header' },
            e('strong', {}, m.name), e(StatusBadge, { status: m.status })
          ),
          e(HealthBar, { value: m.health }),
          e('div', { className: 'sensor-grid' },
            (m.sensors || []).map(s => e('div', { key: s.id, className: 'sensor-chip' },
              e('div', { className: 'muted', style: { fontSize: 11 } }, s.type),
              e('div', { className: 'sensor-val' }, s.latest + ' ' + (s.unit || ''))
            ))
          ),
          e('div', { className: 'live-card-footer' },
            e('span', { className: 'muted' }, 'Anomaly: ' + Math.round((m.anomalyScore || 0) * 100) + '%'),
            e('button', { className: 'btn btn-sm', onClick: () => onSelectMachine(m.id) }, 'Details')
          )
        ))
      )
    );
  }

  // ── Sensor Data ──
  function SensorDataPage({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const [msg, setMsg] = useState('');
    const { data: datasets, loading, refetch } = useFetch('/api/datasets');
    function onFile(ev) {
      const f = ev.target.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('file', f);
      fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json()).then(d => {
        setMsg('Uploaded ' + d.originalname + ' (' + d.rows + ' rows parsed)');
        refetch();
      });
      Papa.parse(f, { header: true, complete: res => setMsg('CSV preview: ' + res.data.length + ' rows, ' + (res.meta.fields || []).length + ' columns') });
    }
    return e(PageShell, { title: 'Sensor Data', org: data.organization, shell },
      e('div', { className: 'two-col' },
        e('div', { className: 'card' },
          e('h3', {}, 'Upload Dataset'),
          e('p', { className: 'muted' }, 'Upload CSV sensor logs for GNN training & batch analysis. Supports vibration, temperature, pressure formats.'),
          e('div', { className: 'upload-zone' },
            e('input', { type: 'file', accept: '.csv,.json', onChange: onFile }),
            e('div', { className: 'muted' }, 'Drag & drop or click to browse')
          ),
          msg && e('div', { className: 'upload-msg' }, msg)
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Data Pipeline Status'),
          e('div', { className: 'pipeline-steps' },
            ['Ingest', 'Validate', 'Feature Extract', 'GNN Inference', 'Alert'].map((s, i) =>
              e('div', { key: s, className: 'pipeline-step' + (i < 4 ? ' done' : '') }, e('span', { className: 'step-num' }, i + 1), s)
            )
          ),
          e('div', { style: { marginTop: 16 } },
            e('div', { className: 'muted' }, 'Total machines monitored'), e('strong', {}, (data.machines || []).length),
            e('div', { className: 'muted', style: { marginTop: 8 } }, 'Total sensor streams'),
            e('strong', {}, (data.machines || []).reduce((s, m) => s + (m.sensors || []).length, 0))
          )
        )
      ),
      e('div', { className: 'card', style: { marginTop: 16 } },
        e('h3', {}, 'Uploaded Datasets'),
        loading ? e(LoadingState) : (datasets || []).length === 0
          ? e(EmptyState, { msg: 'No datasets uploaded yet' })
          : e(DataTable, {
            columns: [
              { key: 'originalname', label: 'File' }, { key: 'rows', label: 'Rows' },
              { key: 'size', label: 'Size', render: r => Math.round(r.size / 1024) + ' KB' },
              { key: 'uploadedAt', label: 'Uploaded', render: r => formatIST(r.uploadedAt, settings.timezone) }
            ],
            rows: datasets
          })
      )
    );
  }

  // ── GNN Graph ──
  function GNNGraphPage({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: graph, loading } = useFetch('/api/gnn/graph');
    const { data: model } = useFetch('/api/model-status');
    const containerRef = useRef(null);
    const networkRef = useRef(null);

    useEffect(() => {
      if (loading || !graph || !containerRef.current || typeof vis === 'undefined') return;

      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }

      const groups = {
        factory: { color: { background: '#dbeafe', border: '#3b82f6' }, size: 28, font: { size: 13, color: '#1e3a8a' }, shape: 'box' },
        operational: { color: { background: '#d1fae5', border: '#10b981' }, size: 20, font: { size: 12 } },
        degraded: { color: { background: '#fef3c7', border: '#f59e0b' }, size: 20, font: { size: 12 } },
        critical: { color: { background: '#fee2e2', border: '#ef4444' }, size: 22, font: { size: 12 } },
        sensor: { color: { background: '#f0fdfa', border: '#0ea5a4' }, size: 12, font: { size: 10 }, shape: 'dot' }
      };

      const nodes = new vis.DataSet(graph.nodes.map(n => ({
        ...n,
        title: n.health != null ? n.label + '<br>Health: ' + n.health + '%' : n.label
      })));
      const edges = new vis.DataSet(graph.edges.map(ed => ({
        from: ed.from,
        to: ed.to,
        dashes: ed.type === 'correlates',
        color: ed.type === 'correlates' ? '#cbd5e1' : '#94a3b8',
        width: ed.type === 'correlates' ? 1 : 2
      })));

      const network = new vis.Network(containerRef.current, { nodes, edges }, {
        groups,
        physics: {
          enabled: true,
          stabilization: { iterations: 200, fit: true },
          barnesHut: { gravitationalConstant: -5000, springLength: 140, springConstant: 0.04 }
        },
        interaction: { hover: true, tooltipDelay: 80, navigationButtons: true, keyboard: { enabled: true } },
        edges: { smooth: { type: 'continuous' } },
        nodes: { borderWidth: 2, shadow: true }
      });

      network.on('stabilizationIterationsDone', () => {
        network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
      });

      networkRef.current = network;

      return () => {
        if (networkRef.current) {
          networkRef.current.destroy();
          networkRef.current = null;
        }
      };
    }, [graph, loading]);

    return e(PageShell, { title: 'GNN Graph', org: data.organization, shell },
      e('div', { className: 'gnn-layout' },
        e('div', { className: 'card gnn-graph-card' },
          e('button', {
            type: 'button',
            className: 'chart-download-btn',
            title: 'Download ultra-high-res PNG (6000px, 300 DPI, white background)',
            onClick: () => {
              if (networkRef.current && containerRef.current) {
                downloadVisNetworkPublication(networkRef.current, containerRef.current, 'gnn-graph-topology');
              } else {
                const canvas = containerRef.current?.querySelector('canvas');
                downloadCanvasAsPng(canvas, 'gnn-graph-topology');
              }
            }
          }, '↓ Download'),
          e('div', { className: 'graph-wrap gnn-graph-wrap', ref: containerRef },
            loading && e('div', { className: 'graph-loading' }, 'Building GNN topology…')
          )
        ),
        e('div', { className: 'gnn-sidebar' },
          e('div', { className: 'card' },
            e('h4', {}, 'Graph Neural Network'),
            model && e('div', { className: 'detail-rows' },
              e('div', {}, e('span', { className: 'muted' }, 'Model'), model.name),
              e('div', {}, e('span', { className: 'muted' }, 'Accuracy'), model.accuracy + '%'),
              e('div', {}, e('span', { className: 'muted' }, 'F1 Score'), model.f1Score),
              e('div', {}, e('span', { className: 'muted' }, 'Latency'), model.inferenceLatencyMs + 'ms'),
              e('div', {}, e('span', { className: 'muted' }, 'Nodes'), model.nodesInGraph),
              e('div', {}, e('span', { className: 'muted' }, 'Region'), model.deployedRegion)
            )
          ),
          e('div', { className: 'card' },
            e('h4', {}, 'Graph Legend'),
            e('div', { className: 'legend' },
              ['Factory', 'Operational', 'Degraded', 'Critical', 'Sensor'].map(l =>
                e('div', { key: l, className: 'legend-item' }, e('span', { className: 'legend-dot legend-' + l.toLowerCase() }), l)
              )
            )
          )
        )
      )
    );
  }

  // ── Predictive Maintenance ──
  function PredictiveMaintenance({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: pm, loading } = useFetch('/api/predictive-maintenance');
    return e(PageShell, { title: 'Predictive Maintenance', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Scheduled Tasks', value: (pm?.tasks || []).length, muted: 'This month' }),
          e(KPICard, { title: 'Emergency', value: (pm?.tasks || []).filter(t => t.type === 'Emergency').length, color: '#ef4444' }),
          e(KPICard, { title: 'GNN Predicted', value: (pm?.tasks || []).filter(t => t.type === 'Predictive').length, color: '#0ea5a4' }),
          e(KPICard, { title: 'Total Cost', value: formatINR((pm?.tasks || []).reduce((s, t) => s + t.costINR, 0)) })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Maintenance Schedule'),
          e(DataTable, {
            columns: [
              { key: 'type', label: 'Type', render: r => e(SeverityBadge, { severity: r.priority === 'critical' ? 'critical' : r.priority === 'high' ? 'high' : 'medium' }) },
              { key: 'task', label: 'Task' },
              { key: 'machineId', label: 'Machine' },
              { key: 'dueDate', label: 'Due' },
              { key: 'costINR', label: 'Cost', render: r => formatINR(r.costINR) },
              { key: 'priority', label: 'Priority', render: r => e(SeverityBadge, { severity: r.priority }) }
            ],
            rows: pm?.tasks || []
          })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'GNN Failure Predictions'),
          e(DataTable, {
            columns: [
              { key: 'machineName', label: 'Machine' },
              { key: 'health', label: 'Health', render: r => e(HealthBar, { value: r.health }) },
              { key: 'rulDays', label: 'RUL', render: r => r.rulDays + ' days' },
              { key: 'failureProbability', label: 'Failure %', render: r => e('span', { style: { color: r.failureProbability > 50 ? '#ef4444' : 'inherit', fontWeight: 700 } }, r.failureProbability + '%') },
              { key: 'recommendedAction', label: 'Action' },
              { key: 'estimatedCostINR', label: 'Est. Cost', render: r => formatINR(r.estimatedCostINR) }
            ],
            rows: pm?.predictions || []
          })
        )
      )
    );
  }

  // ── Fault Diagnosis ──
  function FaultDiagnosis({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: diagnoses, loading } = useFetch('/api/fault-diagnosis');
    return e(PageShell, { title: 'Fault Diagnosis', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'diagnosis-grid' },
        (diagnoses || []).map(d => e('div', { key: d.machineId, className: 'card diagnosis-card' },
          e('div', { className: 'diagnosis-header' },
            e('h3', {}, d.machineName), e(StatusBadge, { status: d.status })
          ),
          e('div', { className: 'muted', style: { fontSize: 13, marginBottom: 8 } },
            d.factoryName, ' · ', d.line || '—', ' · Anomaly ', Math.round((d.anomalyScore || 0) * 100) + '%'
          ),
          e(HealthBar, { value: d.health }),
          e('div', { className: 'diagnosis-meta' },
            e('span', { className: 'muted' }, 'RUL: '), e('strong', {}, (d.rulDays || '—') + ' days (' + (d.rulHours || '—') + ' hrs)')
          ),
          e('div', { className: 'diagnosis-root' },
            e('span', { className: 'muted' }, 'Root Cause: '), e('strong', {}, d.rootCause)
          ),
          e('div', { className: 'muted' }, 'GNN Confidence: ' + Math.round((d.gnnConfidence || 0) * 100) + '%'),
          e('div', { className: 'fault-list' },
            (d.faults || []).map((f, i) => e('div', { key: i, className: 'fault-item' },
              e('div', { className: 'fault-item-header' },
                e(SeverityBadge, { severity: f.severity || 'medium' }),
                e('strong', {}, f.label || f.type)
              ),
              e('div', { className: 'muted' }, 'Probability: ' + Math.round((f.probability || 0) * 100) + '% · Confidence: ' + Math.round((f.confidence || 0) * 100) + '%'),
              e('div', { className: 'fault-action' }, '→ ' + (f.action || 'Inspect machine'))
            ))
          )
        ))
      )
    );
  }

  // ── Anomaly Detection ──
  function AnomalyDetection({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: anomalies, loading } = useFetch('/api/anomaly-detection');
    const [selected, setSelected] = useState(null);
    const sel = (anomalies || []).find(a => a.machineId === selected);
    return e(PageShell, { title: 'Anomaly Detection', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'anomaly-layout' },
        e('div', { className: 'card' },
          e('h3', {}, 'Anomaly Scores'),
          e(DataTable, {
            columns: [
              { key: 'machineName', label: 'Machine' },
              { key: 'anomalyScore', label: 'Score', render: r => e('span', { style: { color: r.anomalyScore > 0.6 ? '#ef4444' : r.anomalyScore > 0.4 ? '#f59e0b' : '#10b981', fontWeight: 700 } }, Math.round(r.anomalyScore * 100) + '%') },
              { key: 'isAnomaly', label: 'Flag', render: r => r.isAnomaly ? e(SeverityBadge, { severity: 'critical' }) : e('span', { className: 'muted' }, 'Normal') },
              { key: 'sensorAnomalies', label: 'Sensor Breaches', render: r => r.sensorAnomalies.length },
              { key: 'action', label: '', render: r => e('button', { className: 'btn btn-sm', onClick: () => setSelected(r.machineId) }, 'Timeline') }
            ],
            rows: anomalies || [],
            onRowClick: r => setSelected(r.machineId)
          })
        ),
        sel && e('div', { className: 'card' },
          e('h3', {}, sel.machineName + ' — 12h Anomaly Timeline'),
          e(LineChart, {
            labels: sel.timeline.map(t => 'H' + t.hour),
            datasets: [{ label: 'Anomaly Score', data: sel.timeline.map(t => t.score), borderColor: '#ef4444', fill: true, backgroundColor: 'rgba(239,68,68,0.1)' }],
            downloadName: 'anomaly-timeline'
          }),
          sel.sensorAnomalies.length > 0 && e('div', { style: { marginTop: 12 } },
            e('h4', {}, 'Threshold Breaches'),
            sel.sensorAnomalies.map((s, i) => e('div', { key: i, className: 'sensor-row' },
              e(SeverityBadge, { severity: s.severity }), e('span', {}, s.sensor + ': ' + s.value + ' (limit: ' + s.threshold + ')')
            ))
          )
        )
      )
    );
  }

  // ── RUL Prediction ──
  function RULPrediction({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: rul, loading } = useFetch('/api/rul-prediction');
    const [selected, setSelected] = useState(null);
    const sel = (rul || []).find(r => r.machineId === selected) || (rul || [])[0];
    useEffect(() => { if (rul && rul.length && !selected) setSelected(rul[0].machineId); }, [rul]);
    return e(PageShell, { title: 'RUL Prediction', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'rul-layout' },
        e('div', { className: 'card' },
          e('h3', {}, 'Remaining Useful Life — All Assets'),
          e(DataTable, {
            columns: [
              { key: 'machineName', label: 'Machine' }, { key: 'type', label: 'Type' },
              { key: 'health', label: 'Health', render: r => e(HealthBar, { value: r.health }) },
              { key: 'rulDays', label: 'RUL (days)', render: r => e('span', { style: { fontWeight: 700, color: r.rulDays <= 7 ? '#ef4444' : r.rulDays <= 14 ? '#f59e0b' : '#10b981' } }, r.rulDays) },
              { key: 'rulHours', label: 'RUL (hrs)' },
              { key: 'confidence', label: 'Confidence', render: r => Math.round(r.confidence * 100) + '%' },
              { key: 'failureMode', label: 'Failure Mode' }
            ],
            rows: rul || [],
            onRowClick: r => setSelected(r.machineId)
          })
        ),
        sel && e('div', { className: 'card' },
          e('h3', {}, sel.machineName + ' — Degradation Forecast'),
          e(LineChart, {
            labels: sel.degradationCurve.map(d => 'Day ' + d.day),
            datasets: [{ label: 'Predicted Health %', data: sel.degradationCurve.map(d => Math.round(d.health)), borderColor: '#0ea5a4', fill: true, backgroundColor: 'rgba(14,165,164,0.1)' }],
            downloadName: 'rul-degradation-forecast'
          }),
          e('div', { className: 'rul-summary' },
            e('div', {}, e('span', { className: 'muted' }, 'Estimated failure'), e('strong', {}, 'Day ' + sel.rulDays)),
            e('div', {}, e('span', { className: 'muted' }, 'Failure mode'), e('strong', {}, sel.failureMode)),
            e('div', {}, e('span', { className: 'muted' }, 'Model confidence'), e('strong', {}, Math.round(sel.confidence * 100) + '%'))
          )
        )
      )
    );
  }

  // ── Analytics ──
  function AnalyticsPage({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: analytics, loading } = useFetch('/api/analytics');
    const kpis = analytics?.kpis || {};
    return e(PageShell, { title: 'Analytics', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Fleet OEE', value: kpis.avgOEE + '%', trend: 1.8 }),
          e(KPICard, { title: 'Uptime', value: kpis.avgUptime + '%', trend: 0.5 }),
          e(KPICard, { title: 'Downtime Cost', value: formatINR(kpis.estimatedDowntimeCostINR), color: '#ef4444' }),
          e(KPICard, { title: 'Maint. Budget', value: formatINR(kpis.maintenanceCostINR) })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'Health Trend (7 periods)'),
            e(LineChart, {
              labels: ['P-6', 'P-5', 'P-4', 'P-3', 'P-2', 'P-1', 'Now'],
              datasets: [{ label: 'Avg Health %', data: analytics.healthTrend, borderColor: '#0ea5a4', fill: false }],
              downloadName: 'health-trend'
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'Alerts by Severity'),
            e(DoughnutChart, {
              labels: ['Critical', 'High', 'Medium', 'Low'],
              data: [analytics.alertsBySeverity.critical, analytics.alertsBySeverity.high, analytics.alertsBySeverity.medium, analytics.alertsBySeverity.low],
              downloadName: 'alerts-by-severity'
            })
          )
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'OEE by Factory'),
            e(BarChart, { labels: analytics.oeeByFactory.map(f => f.name), data: analytics.oeeByFactory.map(f => f.oee), label: 'OEE', color: '#3b82f6', downloadName: 'analytics-oee-by-factory' })
          ),
          e(ChartBox, {}, e('h3', {}, 'Maintenance Cost Breakdown (INR)'),
            e(BarChart, {
              labels: ['Preventive', 'Predictive', 'Emergency'],
              data: [analytics.costBreakdown.preventive, analytics.costBreakdown.predictive, analytics.costBreakdown.emergency],
              label: 'Cost INR', color: '#f59e0b',
              downloadName: 'maintenance-cost-breakdown'
            })
          )
        )
      )
    );
  }

  // ── Alerts ──
  function AlertsPage({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: alertList, loading } = useFetch('/api/alerts');
    const [filter, setFilter] = useState('');
    const filtered = useMemo(() => {
      if (!alertList) return [];
      if (!filter) return alertList;
      return alertList.filter(a => a.severity === filter);
    }, [alertList, filter]);
    function acknowledge(id) {
      fetch('/api/alerts/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'acknowledged' }) })
        .then(() => window.location.reload());
    }
    function ackAll() {
      fetch('/api/alerts/acknowledge-all', { method: 'POST' }).then(() => window.location.reload());
    }
    const openCount = (alertList || []).filter(a => a.status === 'open').length;
    return e(PageShell, { title: 'Alerts', org: data.organization, shell },
      e('div', { className: 'toolbar' },
        e('select', { className: 'select', value: filter, onChange: ev => setFilter(ev.target.value) },
          e('option', { value: '' }, 'All severities'), e('option', { value: 'critical' }, 'Critical'), e('option', { value: 'high' }, 'High'), e('option', { value: 'medium' }, 'Medium')),
        e('button', { className: 'btn secondary btn-sm', onClick: ackAll }, 'Acknowledge All (' + openCount + ')')
      ),
      loading ? e(LoadingState) : e('div', { className: 'alerts-list' },
        filtered.map(a => e('div', { key: a.id, className: 'alert-card card alert-' + a.severity },
          e('div', { className: 'alert-header' },
            e(SeverityBadge, { severity: a.severity }),
            e('span', { className: 'alert-cat badge badge-operational' }, a.category),
            e('span', { className: 'muted', style: { marginLeft: 'auto', fontSize: 12 } }, formatIST(a.time, settings.timezone))
          ),
          e('div', { className: 'alert-body' }, e('strong', {}, a.machineName), ' — ', a.text),
          a.recommendation && e('div', { className: 'alert-rec muted' }, '→ ' + a.recommendation),
          e('div', { className: 'alert-footer' },
            e('span', { className: 'badge badge-' + (a.status === 'open' ? 'critical' : 'operational') }, a.status),
            a.status === 'open' && e('button', { className: 'btn btn-sm', onClick: () => acknowledge(a.id) }, 'Acknowledge')
          )
        ))
      )
    );
  }

  // ── Reports ──
  function ReportsPage({ data, shell }) {
    const { settings, onUpdateSettings } = shell;
    const { data: reportList, loading } = useFetch('/api/reports');
    const [generating, setGenerating] = useState(false);
    const [latest, setLatest] = useState(null);
    function generate(type) {
      setGenerating(true);
      fetch('/api/reports/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: type === 'executive' ? 'Executive Summary Report' : 'Comprehensive Maintenance Report', period: 'Last 30 days' })
      }).then(r => r.json()).then(r => { setLatest(r); setGenerating(false); }).catch(() => setGenerating(false));
    }
    return e(PageShell, { title: 'Reports', org: data.organization, shell },
      e('div', { className: 'toolbar' },
        e('button', { className: 'btn', onClick: () => generate('comprehensive'), disabled: generating }, generating ? 'Generating...' : 'Generate Full Report'),
        e('button', { className: 'btn secondary', onClick: () => generate('executive'), disabled: generating }, 'Executive Summary')
      ),
      latest && e('div', { className: 'card report-preview' },
        e('h3', {}, latest.title),
        e('div', { className: 'muted' }, 'Generated: ' + formatIST(latest.generatedAt, settings.timezone) + ' · ' + latest.organization),
        e('div', { className: 'report-kpis' },
          e(KPICard, { title: 'Avg Health', value: latest.summary.avgHealth + '%' }),
          e(KPICard, { title: 'OEE', value: latest.summary.avgOEE + '%' }),
          e(KPICard, { title: 'Open Alerts', value: latest.summary.openAlerts }),
          e(KPICard, { title: 'Maint. Cost', value: formatINR(latest.summary.maintenanceCostINR) })
        ),
        latest.sections.map((s, i) => e('div', { key: i, className: 'report-section' },
          e('h4', {}, s.title), e('p', {}, s.content)
        )),
        e('button', { className: 'btn secondary btn-sm', onClick: () => {
          const blob = new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = latest.reportId + '.json'; a.click();
        }}, 'Download JSON')
      ),
      e('div', { className: 'card', style: { marginTop: 16 } },
        e('h3', {}, 'Report History'),
        loading ? e(LoadingState) : (reportList || []).length === 0 && !latest
          ? e(EmptyState, { msg: 'No reports generated yet. Click "Generate Full Report" above.' })
          : e(DataTable, {
            columns: [
              { key: 'reportId', label: 'ID' }, { key: 'title', label: 'Title' }, { key: 'type', label: 'Type' },
              { key: 'generatedAt', label: 'Generated', render: r => formatIST(r.generatedAt, settings.timezone) }
            ],
            rows: latest ? [latest, ...(reportList || [])] : (reportList || [])
          })
      )
    );
  }

  window.InduGraphPages = {
    Overview, FactoryPage, MachinesPage, MachineDetail, LiveMonitoring,
    SensorDataPage, GNNGraphPage, PredictiveMaintenance, FaultDiagnosis,
    AnomalyDetection, RULPrediction, AnalyticsPage, AlertsPage, ReportsPage
  };
})();
