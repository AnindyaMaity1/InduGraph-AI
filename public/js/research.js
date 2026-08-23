/* InduGraph AI — Research module pages */
(function () {
  const {
    e, useState, useEffect, useMemo,
    formatINR, formatIST,
    useFetch,
    PageShell, ResearchPageShell, KPICard, LoadingState, EmptyState, ChartBox,
    LineChart, BarChart, DoughnutChart, DataTable, HealthBar, StatusBadge
  } = window.InduGraph;

  function ResearchBadge({ text }) {
    return e('span', { className: 'research-badge' }, text);
  }

  function MethodologyCard({ methodology }) {
    if (!methodology) return null;
    return e('div', { className: 'card research-methodology' },
      e('h3', {}, 'Methodology'),
      e('div', { className: 'method-grid' },
        Object.entries(methodology).map(([k, v]) =>
          e('div', { key: k, className: 'method-item' },
            e('div', { className: 'method-key' }, k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())),
            e('div', { className: 'method-val' }, v)
          )
        )
      )
    );
  }

  function PublicationList({ publications }) {
    return e('div', { className: 'card' },
      e('h3', {}, 'Publications'),
      (publications || []).map((p, i) => e('div', { key: i, className: 'pub-item' },
        e('div', { className: 'pub-title' }, p.title),
        e('div', { className: 'muted' }, p.venue + ' · ' + p.year),
        e(ResearchBadge, { text: p.status })
      ))
    );
  }

  // ── Research Lab ──
  function PipelineStage({ stage }) {
    const colors = { complete: '#10b981', active: '#8b5cf6', pending: '#94a3b8' };
    return e('div', { className: 'pipeline-stage' },
      e('div', { className: 'pipeline-stage-header' },
        e('span', { className: 'pipeline-stage-name' }, stage.stage),
        e(ResearchBadge, { text: stage.status })
      ),
      e('div', { className: 'pipeline-bar' },
        e('div', { className: 'pipeline-bar-fill', style: { width: stage.progress + '%', background: colors[stage.status] || '#94a3b8' } })
      ),
      e('div', { className: 'pipeline-meta muted' }, stage.progress + '% · ' + (stage.owner || ''))
    );
  }

  function GpuCard({ gpu }) {
    return e('div', { className: 'gpu-card' },
      e('div', { className: 'gpu-card-header' },
        e('strong', {}, gpu.id),
        e('span', { className: 'muted' }, gpu.model)
      ),
      e('div', { className: 'gpu-util' },
        e('div', { className: 'gpu-util-bar' },
          e('div', { className: 'gpu-util-fill', style: { width: gpu.utilization + '%', background: gpu.utilization > 80 ? '#ef4444' : '#8b5cf6' } })
        ),
        e('span', {}, gpu.utilization + '%')
      ),
      e('div', { className: 'gpu-mem muted' }, 'VRAM ', gpu.memoryUsed, '/', gpu.memoryTotal, ' GB'),
      e('div', { className: 'gpu-job' }, gpu.job)
    );
  }

  function QuickNavCard({ href, title, desc, badge }) {
    return e('a', { href, className: 'quick-nav-card card' },
      badge && e(ResearchBadge, { text: badge }),
      e('h4', {}, title),
      e('p', { className: 'muted' }, desc)
    );
  }

  function ResearchLabPage({ data, shell }) {
    const { data: overview, loading: ovLoading } = useFetch('/api/research/overview');
    const { data: dash, loading: dashLoading } = useFetch('/api/research/lab-dashboard');
    const p = overview?.project;
    const cv = dash?.crossValidation;
    const loading = ovLoading || dashLoading;

    return e(ResearchPageShell, { title: 'Research Lab', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Deployed F1', value: overview?.deployedModel?.f1 || '—', muted: 'InduGraph-GNN v2.1' }),
          e(KPICard, { title: 'RUL MAE', value: (overview?.deployedModel?.rulMae || '—') + ' hrs', muted: '↓ ' + (overview?.benchmark?.rulMae || '') + ' vs LSTM' }),
          e(KPICard, { title: 'CV F1 (5-fold)', value: cv?.mean?.f1 || '—', muted: '± ' + (cv?.std?.f1 || '—') }),
          e(KPICard, { title: 'Graph Nodes', value: dash?.graphStats?.nodes || '—', muted: (dash?.graphStats?.edges || 0) + ' edges · live' }),
          e(KPICard, { title: 'HPO Trials', value: dash?.hyperparamSearch?.trials || 0, muted: dash?.hyperparamSearch?.framework || 'Optuna' }),
          e(KPICard, { title: 'GPU Cluster', value: (dash?.compute?.gpus || []).filter(g => g.utilization > 0).length + '/' + (dash?.compute?.gpus || []).length, muted: 'A100 nodes active' })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Research Modules'),
          e('div', { className: 'quick-nav-grid' },
            e(QuickNavCard, { href: '#research/ComputeCluster', title: 'Compute Cluster', desc: 'A100 GPU utilization, VRAM & job queue', badge: 'Infrastructure' }),
            e(QuickNavCard, { href: '#research/CrossValidation', title: 'Cross Validation', desc: '5-fold temporal CV across Indian plants', badge: 'Evaluation' }),
            e(QuickNavCard, { href: '#research/ModelRegistry', title: 'Model Registry', desc: 'Version control, deployment & checksums', badge: 'MLOps' }),
            e(QuickNavCard, { href: '#research/FeatureDrift', title: 'Feature Drift', desc: 'Production drift monitoring & alerts', badge: 'Monitoring' }),
            e(QuickNavCard, { href: '#research/GraphAnalytics', title: 'Graph Analytics', desc: 'Live heterogeneous graph topology stats', badge: 'Graph' }),
            e(QuickNavCard, { href: '#research/ResearchPipeline', title: 'Research Pipeline', desc: 'End-to-end project stage tracker', badge: 'Project' }),
            e(QuickNavCard, { href: '#research/Experiments', title: 'Experiments', desc: 'Full experiment registry & training curves', badge: 'Core' }),
            e(QuickNavCard, { href: '#research/Benchmarks', title: 'Benchmarks', desc: 'InduGraph vs LSTM, RF & classical baselines', badge: 'Evaluation' }),
            e(QuickNavCard, { href: '#research/Explainability', title: 'Explainability', desc: 'GNN attention maps & saliency analysis', badge: 'XAI' }),
            e(QuickNavCard, { href: '#research/Ablation', title: 'Ablation Studies', desc: 'Component-wise contribution analysis', badge: 'Analysis' })
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Recent Research Activity'),
          e('div', { className: 'activity-feed' },
            (dash?.activity || []).length === 0 ? e(EmptyState, { msg: 'No recent activity' }) :
            (dash?.activity || []).map(a => e('div', { key: a.id, className: 'activity-item activity-item-detailed' },
              e(ResearchBadge, { text: a.tag }),
              e('div', { className: 'activity-body' },
                e('strong', {}, a.title),
                e('div', { className: 'muted activity-meta' }, a.date, ' · ', a.author, ' · ', a.type),
                a.summary && e('p', { className: 'activity-summary' }, a.summary),
                a.detail && e('div', { className: 'muted activity-detail' }, a.detail),
                a.metrics && e('div', { className: 'activity-metrics' }, a.metrics)
              )
            ))
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Research Objectives'),
          e('ol', { className: 'objective-list' }, (p?.objectives || []).map((o, i) => e('li', { key: i }, o)))
        ),
        e(MethodologyCard, { methodology: overview?.methodology })
      )
    );
  }

  // ── Compute Cluster ──
  function ComputeClusterPage({ data, shell }) {
    const { data: dash, loading, refetch } = useFetch('/api/research/lab-dashboard');
    const [jobName, setJobName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const compute = dash?.compute;

    function submitJob() {
      if (!jobName.trim()) return;
      setSubmitting(true);
      fetch('/api/research/compute/submit-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: jobName, priority: 'medium' })
      }).then(() => { setJobName(''); setTimeout(() => { refetch(); setSubmitting(false); }, 800); });
    }

    return e(ResearchPageShell, { title: 'Compute Cluster', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'research-highlight card' },
          e('strong', {}, compute?.cluster), ' · ',
          (compute?.gpus || []).filter(g => g.utilization > 0).length, ' GPUs active · Storage ',
          compute?.storageUsedTB, '/', compute?.storageTotalTB, ' TB'
        ),
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'GPUs Active', value: (compute?.gpus || []).filter(g => g.utilization > 0).length + '/' + (compute?.gpus || []).length, muted: 'NVIDIA A100 40GB' }),
          e(KPICard, { title: 'Avg Utilization', value: Math.round((compute?.gpus || []).reduce((s, g) => s + g.utilization, 0) / Math.max(1, (compute?.gpus || []).length)) + '%', muted: 'Cluster-wide' }),
          e(KPICard, { title: 'Queued Jobs', value: (compute?.queue || []).filter(j => j.status === 'queued').length, muted: 'Pending execution' }),
          e(KPICard, { title: 'Running Jobs', value: (compute?.queue || []).filter(j => j.status === 'running').length, muted: 'In progress' })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'GPU Nodes'),
          e('div', { className: 'gpu-grid' }, (compute?.gpus || []).map(g => e(GpuCard, { key: g.id, gpu: g }))),
          e('div', { className: 'storage-bar-wrap' },
            e('div', { className: 'muted', style: { marginBottom: 6 } }, 'Research Storage'),
            e('div', { className: 'pipeline-bar' },
              e('div', { className: 'pipeline-bar-fill', style: { width: ((compute?.storageUsedTB / compute?.storageTotalTB) * 100) + '%', background: '#0ea5a4' } })
            )
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Submit Training Job'),
          e('div', { className: 'toolbar' },
            e('input', { className: 'input', style: { maxWidth: 400 }, placeholder: 'Job name (e.g. GNN retrain — Pune subset)', value: jobName, onChange: ev => setJobName(ev.target.value) }),
            e('button', { className: 'btn', onClick: submitJob, disabled: submitting }, submitting ? 'Submitting…' : 'Submit to Queue')
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Job Queue'),
          e(DataTable, {
            columns: [
              { key: 'id', label: 'Job ID' },
              { key: 'name', label: 'Task' },
              { key: 'status', label: 'Status', render: r => e(ResearchBadge, { text: r.status }) },
              { key: 'eta', label: 'ETA' },
              { key: 'priority', label: 'Priority', render: r => e('span', { style: { color: r.priority === 'high' ? '#ef4444' : '#64748b', fontWeight: 600 } }, r.priority) }
            ],
            rows: compute?.queue || []
          })
        )
      )
    );
  }

  // ── Hyperparameter Search ──
  function HyperparamSearchPage({ data, shell }) {
    const { data: dash, loading, refetch } = useFetch('/api/research/lab-dashboard');
    const [running, setRunning] = useState(false);
    const hpo = dash?.hyperparamSearch;
    const space = dash?.hyperparamSearchSpace || {};

    function runTrial() {
      setRunning(true);
      fetch('/api/research/hyperparam-search/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(() => setTimeout(() => { refetch(); setRunning(false); }, 1500));
    }

    return e(ResearchPageShell, { title: 'Hyperparameter Search', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'toolbar' },
          e('span', { className: 'muted' }, hpo?.framework, ' · ', hpo?.trials, ' trials completed'),
          e('button', { className: 'btn', onClick: runTrial, disabled: running }, running ? 'Running trial…' : '+ Run New Trial')
        ),
        hpo?.bestTrial && e('div', { className: 'research-highlight card' },
          e('strong', {}, 'Best Trial #', hpo.bestTrial.id, ': '),
          'F1=', hpo.bestTrial.f1, ' · RUL MAE=', hpo.bestTrial.rulMae, 'h · lr=', hpo.bestTrial.lr,
          ' · heads=', hpo.bestTrial.heads, ' · hidden=', hpo.bestTrial.hiddenDim, ' · dropout=', hpo.bestTrial.dropout
        ),
        e('div', { className: 'two-col' },
          e('div', { className: 'card' },
            e('h3', {}, 'Search Space'),
            e('div', { className: 'method-grid' },
              Object.entries(space).map(([k, v]) => e('div', { key: k, className: 'method-item' },
                e('div', { className: 'method-key' }, k),
                e('div', { className: 'method-val' }, Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v)
              ))
            )
          ),
          hpo?.topTrials && e(ChartBox, {}, e('h3', {}, 'Top Trial Scores'),
            e(BarChart, {
              labels: hpo.topTrials.map(t => 'T' + t.trial),
              data: hpo.topTrials.map(t => t.score * 100),
              label: 'Score × 100', color: '#8b5cf6', height: 260, yMax: 100
            })
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Top Trials'),
          e(DataTable, {
            columns: [
              { key: 'trial', label: 'Trial' },
              { key: 'f1', label: 'F1', render: r => r.f1.toFixed(3) },
              { key: 'rulMae', label: 'RUL MAE', render: r => r.rulMae + 'h' },
              { key: 'lr', label: 'Learning Rate' },
              { key: 'score', label: 'Composite Score', render: r => e('strong', {}, r.score.toFixed(3)) }
            ],
            rows: hpo?.topTrials || []
          })
        )
      )
    );
  }

  // ── Cross Validation ──
  function CrossValidationPage({ data, shell }) {
    const { data: dash, loading } = useFetch('/api/research/lab-dashboard');
    const cv = dash?.crossValidation;

    return e(ResearchPageShell, { title: 'Cross Validation', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'research-highlight card' },
          e('strong', {}, cv?.folds, '-Fold CV · '), cv?.strategy
        ),
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Mean F1', value: cv?.mean?.f1, muted: '± ' + cv?.std?.f1 }),
          e(KPICard, { title: 'Mean RUL MAE', value: cv?.mean?.rulMae + ' hrs', muted: '± ' + cv?.std?.rulMae + 'h' }),
          e(KPICard, { title: 'Mean AUC', value: cv?.mean?.auc, muted: '± ' + cv?.std?.auc }),
          e(KPICard, { title: 'Folds', value: cv?.folds, muted: 'Plant-wise holdout' })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'F1 Score by Fold'),
            e(BarChart, {
              labels: (cv?.results || []).map(r => 'F' + r.fold),
              data: (cv?.results || []).map(r => r.f1 * 100),
              label: 'F1 × 100', color: '#8b5cf6', height: 280, yMax: 100
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'RUL MAE by Fold (lower is better)'),
            e(BarChart, {
              labels: (cv?.results || []).map(r => 'F' + r.fold),
              data: (cv?.results || []).map(r => r.rulMae),
              label: 'MAE hrs', color: '#f59e0b', height: 280
            })
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Fold Results'),
          e(DataTable, {
            columns: [
              { key: 'fold', label: 'Fold' },
              { key: 'plant', label: 'Holdout Plant' },
              { key: 'f1', label: 'F1', render: r => r.f1.toFixed(3) },
              { key: 'rulMae', label: 'RUL MAE', render: r => r.rulMae + 'h' },
              { key: 'auc', label: 'AUC', render: r => r.auc.toFixed(3) }
            ],
            rows: cv?.results || []
          })
        )
      )
    );
  }

  // ── Model Registry ──
  function ModelRegistryPage({ data, shell }) {
    const { data: dash, loading, refetch } = useFetch('/api/research/lab-dashboard');
    const [promoting, setPromoting] = useState(null);
    const registry = dash?.modelRegistry || [];

    function promote(version) {
      setPromoting(version);
      fetch('/api/research/model-registry/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version })
      }).then(() => setTimeout(() => { refetch(); setPromoting(null); }, 800));
    }

    return e(ResearchPageShell, { title: 'Model Registry', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'research-highlight card' },
          e('strong', {}, 'MLOps Model Registry'), ' — versioned artifacts with SHA-256 checksums, plant deployment tracking, and promotion workflow.'
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Registered Models'),
          e(DataTable, {
            columns: [
              { key: 'version', label: 'Version' },
              { key: 'experimentId', label: 'Experiment' },
              { key: 'status', label: 'Status', render: r => e(ResearchBadge, { text: r.status }) },
              { key: 'f1', label: 'F1', render: r => r.f1.toFixed(3) },
              { key: 'deployedAt', label: 'Deployed', render: r => r.deployedAt || '—' },
              { key: 'plants', label: 'Plants', render: r => (r.plants || []).join(', ') || '—' },
              { key: 'checksum', label: 'Checksum', render: r => e('code', { className: 'checksum' }, r.checksum) },
              { key: 'action', label: '', render: r => r.status !== 'production' && e('button', {
                className: 'btn btn-sm', disabled: promoting === r.version,
                onClick: () => promote(r.version)
              }, promoting === r.version ? 'Promoting…' : 'Promote') }
            ],
            rows: registry
          })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'F1 by Model Version'),
            e(BarChart, {
              labels: registry.map(m => m.version),
              data: registry.map(m => m.f1 * 100),
              label: 'F1 × 100', color: '#0ea5a4', height: 260, yMax: 100
            })
          ),
          e('div', { className: 'card' },
            e('h3', {}, 'Deployment Status'),
            registry.map(m => e('div', { key: m.version, className: 'registry-deploy-item' },
              e('div', { className: 'registry-deploy-header' },
                e('strong', {}, m.version),
                e(ResearchBadge, { text: m.status })
              ),
              e('div', { className: 'muted' }, 'Experiment: ', m.experimentId, ' · F1: ', m.f1),
              e('div', { className: 'plant-tags' },
                (m.plants || []).length === 0 ? e('span', { className: 'muted' }, 'Not deployed') :
                (m.plants || []).map(p => e('span', { key: p, className: 'plant-tag' }, p))
              )
            ))
          )
        )
      )
    );
  }

  // ── Feature Drift ──
  function FeatureDriftPage({ data, shell }) {
    const { data: dash, loading } = useFetch('/api/research/lab-dashboard');
    const drift = dash?.featureDrift || [];
    const warnings = drift.filter(d => d.status === 'warning').length;

    return e(ResearchPageShell, { title: 'Feature Drift Monitor', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Features Monitored', value: drift.length, muted: 'Production telemetry' }),
          e(KPICard, { title: 'Drift Warnings', value: warnings, color: warnings > 0 ? '#ef4444' : '#10b981', muted: 'Threshold > 15%' }),
          e(KPICard, { title: 'Stable Features', value: drift.length - warnings, muted: 'Within tolerance' }),
          e(KPICard, { title: 'Last Check', value: 'Live', muted: 'Streaming window: 7 days' })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'Drift Magnitude (%)'),
            e(BarChart, {
              labels: drift.map(d => d.feature.split(' ').slice(0, 2).join(' ')),
              data: drift.map(d => Math.abs(d.driftPct)),
              label: '|Drift| %',
              color: drift.map(d => Math.abs(d.driftPct) > 15 ? '#ef4444' : '#10b981'),
              height: 280
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'Baseline vs Current'),
            e(BarChart, {
              labels: drift.map(d => d.feature.split(' ')[0]),
              data: drift.map(d => d.current),
              label: 'Current value', color: '#8b5cf6', height: 280
            })
          )
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Feature Drift Table'),
          e(DataTable, {
            columns: [
              { key: 'feature', label: 'Feature' },
              { key: 'baseline', label: 'Baseline (training)' },
              { key: 'current', label: 'Current (production)' },
              { key: 'driftPct', label: 'Drift', render: r => e('span', { style: { color: Math.abs(r.driftPct) > 15 ? '#ef4444' : '#10b981', fontWeight: 600 } }, (r.driftPct > 0 ? '+' : '') + r.driftPct + '%') },
              { key: 'status', label: 'Status', render: r => e(ResearchBadge, { text: r.status }) }
            ],
            rows: drift
          })
        )
      )
    );
  }

  // ── Graph Analytics ──
  function GraphAnalyticsPage({ data, shell }) {
    const { data: dash, loading } = useFetch('/api/research/lab-dashboard');
    const stats = dash?.graphStats;
    const ga = dash?.graphAnalytics;

    return e(ResearchPageShell, { title: 'Graph Analytics', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'research-highlight card' },
          e('strong', {}, 'Live Heterogeneous Industrial Graph'), ' — rebuilt every ', stats?.rebuildIntervalSec, 's from shop-floor telemetry. Nodes: factory, machine, sensor. Edges: contains, monitors, correlates.'
        ),
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Total Nodes', value: stats?.nodes, muted: stats?.factories + 'F · ' + stats?.machines + 'M · ' + stats?.sensors + 'S' }),
          e(KPICard, { title: 'Total Edges', value: stats?.edges, muted: 'Heterogeneous' }),
          e(KPICard, { title: 'Avg Degree', value: stats?.avgDegree, muted: 'Graph connectivity' }),
          e(KPICard, { title: 'Rebuild', value: stats?.rebuildIntervalSec + 's', muted: 'Dynamic graph refresh' })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'Node Type Distribution'),
            e(DoughnutChart, {
              labels: (ga?.nodeTypes || []).map(n => n.type),
              data: (ga?.nodeTypes || []).map(n => n.count),
              height: 260
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'Edge Type Counts'),
            e(BarChart, {
              labels: (ga?.edgeTypes || []).map(e => e.type.split(' ')[0]),
              data: (ga?.edgeTypes || []).map(e => e.count),
              label: 'Edges', color: '#0ea5a4', height: 260
            })
          )
        ),
        e('div', { className: 'two-col' },
          e('div', { className: 'card' },
            e('h3', {}, 'Top Centrality Nodes'),
            e(DataTable, {
              columns: [
                { key: 'node', label: 'Node' },
                { key: 'type', label: 'Type', render: r => e(ResearchBadge, { text: r.type }) },
                { key: 'score', label: 'Centrality', render: r => e(HealthBar, { value: Math.round(r.score * 100) }) }
              ],
              rows: ga?.topCentrality || []
            })
          ),
          e('div', { className: 'card' },
            e('h3', {}, 'Graph Rebuild History'),
            e(DataTable, {
              columns: [
                { key: 'time', label: 'Timestamp' },
                { key: 'nodes', label: 'Nodes' },
                { key: 'edges', label: 'Edges' },
                { key: 'durationMs', label: 'Duration', render: r => r.durationMs + ' ms' }
              ],
              rows: ga?.rebuildHistory || []
            })
          )
        )
      )
    );
  }

  // ── Research Pipeline ──
  function ResearchPipelinePage({ data, shell }) {
    const { data: dash, loading } = useFetch('/api/research/lab-dashboard');
    const pipeline = dash?.pipeline || [];
    const complete = pipeline.filter(s => s.status === 'complete').length;
    const active = pipeline.filter(s => s.status === 'active').length;

    return e(ResearchPageShell, { title: 'Research Pipeline', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'kpi-grid' },
          e(KPICard, { title: 'Total Stages', value: pipeline.length, muted: 'End-to-end pipeline' }),
          e(KPICard, { title: 'Complete', value: complete, color: '#10b981', muted: 'Finished stages' }),
          e(KPICard, { title: 'Active', value: active, color: '#8b5cf6', muted: 'In progress' }),
          e(KPICard, { title: 'Overall Progress', value: Math.round(pipeline.reduce((s, p) => s + p.progress, 0) / Math.max(1, pipeline.length)) + '%', muted: 'Weighted average' })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Pipeline Stages'),
          e('div', { className: 'pipeline-list' }, pipeline.map(s => e(PipelineStage, { key: s.stage, stage: s })))
        ),
        e(ChartBox, {}, e('h3', {}, 'Stage Progress'),
          e(BarChart, {
            labels: pipeline.map(s => s.stage.split(' ').slice(0, 2).join(' ')),
            data: pipeline.map(s => s.progress),
            label: 'Progress %', color: pipeline.map(s => s.status === 'complete' ? '#10b981' : s.status === 'active' ? '#8b5cf6' : '#94a3b8'),
            height: 300, yMax: 100
          })
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Stage Details'),
          e(DataTable, {
            columns: [
              { key: 'stage', label: 'Stage' },
              { key: 'status', label: 'Status', render: r => e(ResearchBadge, { text: r.status }) },
              { key: 'progress', label: 'Progress', render: r => r.progress + '%' },
              { key: 'owner', label: 'Owner' }
            ],
            rows: pipeline
          })
        )
      )
    );
  }

  // ── Experiments ──
  function ExperimentsPage({ data, shell }) {
    const { data: experiments, loading, refetch } = useFetch('/api/research/experiments');
    const [selected, setSelected] = useState(null);
    const [running, setRunning] = useState(false);
    const { data: curves, loading: curvesLoading, error: curvesError } = useFetch(selected ? '/api/research/experiments/' + selected + '/curves' : null, [selected]);

    function runExperiment() {
      setRunning(true);
      fetch('/api/research/experiments/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Custom GNN Run', epochs: 100, lr: 0.001 })
      }).then(() => { setTimeout(() => { refetch(); setRunning(false); }, 3500); });
    }

    return e(ResearchPageShell, { title: 'Experiments', org: data.organization, shell },
      e('div', { className: 'toolbar' },
        e('button', { className: 'btn', onClick: runExperiment, disabled: running }, running ? 'Training on A100…' : '+ New Experiment'),
        e('span', { className: 'muted' }, (experiments || []).length + ' experiment runs logged')
      ),
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'card' },
          e('h3', {}, 'Experiment Registry'),
          e(DataTable, {
            columns: [
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Model' },
              { key: 'status', label: 'Status', render: r => e(ResearchBadge, { text: r.status }) },
              { key: 'f1', label: 'F1', render: r => r.f1 ? r.f1.toFixed(3) : '—' },
              { key: 'rulMae', label: 'RUL MAE', render: r => r.rulMae ? r.rulMae + 'h' : '—' },
              { key: 'auc', label: 'AUC', render: r => r.auc ? r.auc.toFixed(3) : '—' },
              { key: 'latencyMs', label: 'Latency', render: r => r.latencyMs ? r.latencyMs + 'ms' : '—' },
              { key: 'action', label: '', render: r => e('button', { className: 'btn btn-sm secondary', onClick: () => setSelected(r.id) }, 'Curves') }
            ],
            rows: experiments || [],
            onRowClick: r => setSelected(r.id)
          })
        ),
        selected && e('div', { className: 'card' },
          e('h3', {}, 'Training Curves — ', selected,
            curves?.curveType === 'classical' && e(ResearchBadge, { text: 'Classical ML' })
          ),
          curves?.curveType === 'classical' && !curvesLoading && curves?.epochs && e('p', { className: 'muted', style: { marginBottom: 12 } },
            'Random Forest convergence: OOB error & 5-fold CV vs. number of estimators (500 trees)'
          ),
          curvesLoading ? e(LoadingState) :
          curvesError || !curves?.epochs ? e(EmptyState, { msg: curvesError || 'No training curves available' }) :
          e('div', { className: 'two-col' },
            e(ChartBox, {}, e('h3', {}, curves.trainLabel || 'Training Loss', ' vs ', curves.valLabel || 'Validation Loss'),
              e(LineChart, {
                labels: curves.epochs.map(ep => (curves.xLabel === 'Trees' ? ep + ' trees' : 'Ep ' + ep)),
                datasets: [
                  { label: curves.trainLabel || 'Train Loss', data: curves.trainLoss, borderColor: '#0ea5a4', fill: false },
                  { label: curves.valLabel || 'Val Loss', data: curves.valLoss, borderColor: '#ef4444', fill: false }
                ], height: 260
              })
            ),
            e(ChartBox, {}, e('h3', {}, 'Validation F1 Score'),
              e(LineChart, {
                labels: curves.epochs.map(ep => (curves.xLabel === 'Trees' ? ep + ' trees' : 'Ep ' + ep)),
                datasets: [{ label: 'Val F1', data: curves.valF1, borderColor: '#3b82f6', fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }],
                height: 260
              })
            )
          )
        )
      )
    );
  }

  // ── Benchmarks ──
  function BenchmarksPage({ data, shell }) {
    const { data: bench, loading } = useFetch('/api/research/benchmarks');
    const { data: cm } = useFetch('/api/research/confusion-matrix');
    const { data: roc } = useFetch('/api/research/roc-curve');
    const models = bench?.models || [];

    return e(ResearchPageShell, { title: 'Model Benchmarks', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        bench?.improvementOverLSTM && e('div', { className: 'research-highlight card' },
          e('strong', {}, 'InduGraph-GNN vs LSTM Baseline: '),
          'F1 ', bench.improvementOverLSTM.f1, ' · RUL MAE ', bench.improvementOverLSTM.rulMae, ' · AUC ', bench.improvementOverLSTM.auc
        ),
        e('div', { className: 'card' },
          e('h3', {}, 'Benchmark Comparison'),
          e(DataTable, {
            columns: [
              { key: 'name', label: 'Model' },
              { key: 'type', label: 'Type', render: r => e(ResearchBadge, { text: r.type }) },
              { key: 'f1', label: 'F1', render: r => e('strong', {}, r.f1.toFixed(3)) },
              { key: 'accuracy', label: 'Accuracy', render: r => r.accuracy + '%' },
              { key: 'rulMae', label: 'RUL MAE (hrs)' },
              { key: 'auc', label: 'AUC-ROC', render: r => r.auc.toFixed(3) },
              { key: 'latency', label: 'Latency (ms)' }
            ],
            rows: models
          })
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'F1 Score Comparison'),
            e(BarChart, {
              labels: models.map(m => m.name.split(' ').slice(0, 2).join(' ')),
              data: models.map(m => m.f1 * 100),
              label: 'F1 × 100', color: '#0ea5a4', height: 260, yMax: 100
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'RUL MAE (lower is better)'),
            e(BarChart, {
              labels: models.map(m => m.name.split(' ').slice(0, 2).join(' ')),
              data: models.map(m => m.rulMae),
              label: 'MAE hrs', color: '#f59e0b', height: 260
            })
          )
        ),
        e('div', { className: 'two-col' },
          cm && e('div', { className: 'card' },
            e('h3', {}, 'Confusion Matrix (Test Set)'),
            e('div', { className: 'confusion-matrix' },
              e('table', { className: 'cm-table' },
                e('thead', {}, e('tr', {}, e('th', {}, ''), ...(cm.labels || []).map(l => e('th', { key: l }, l)))),
                e('tbody', {}, (cm.matrix || []).map((row, i) =>
                  e('tr', { key: i },
                    e('th', {}, cm.labels[i]),
                    row.map((v, j) => e('td', { key: j, className: 'cm-cell', style: { background: 'rgba(14,165,164,' + (v / 150) + ')' } }, v))
                  )
                ))
              )
            )
          ),
          roc && e(ChartBox, {}, e('h3', {}, 'ROC Curve (AUC: GNN ' + roc.auc.induGraph + ' vs LSTM ' + roc.auc.lstm + ')'),
            e(LineChart, {
              labels: roc.induGraph.map((_, i) => i),
              datasets: [
                { label: 'InduGraph-GNN', data: roc.induGraph.map(p => p.tpr), borderColor: '#0ea5a4', fill: false },
                { label: 'LSTM', data: roc.lstm.map(p => p.tpr), borderColor: '#94a3b8', fill: false, borderDash: [5, 5] }
              ], height: 260
            })
          )
        )
      )
    );
  }

  // ── Explainability ──
  function ExplainabilityPage({ data, shell, onSelectMachine }) {
    const [machineId, setMachineId] = useState('');
    const url = '/api/research/explainability' + (machineId ? '?machineId=' + machineId : '');
    const { data: xai, loading } = useFetch(url, [machineId]);
    const machines = data.machines || [];

    return e(ResearchPageShell, { title: 'Explainability (XAI)', org: data.organization, shell },
      e('div', { className: 'toolbar' },
        e('select', { className: 'select', value: machineId, onChange: ev => setMachineId(ev.target.value) },
          e('option', { value: '' }, 'Fleet-wide analysis'),
          machines.map(m => e('option', { key: m.id, value: m.id }, m.name))
        ),
        machineId && e('button', { className: 'btn btn-sm', onClick: () => onSelectMachine(machineId) }, 'Open Machine Detail')
      ),
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'card research-highlight' },
          e('strong', {}, 'GNN Attention Analysis — '), xai?.machineName || 'All Assets',
          e('div', { className: 'muted', style: { marginTop: 6 } }, 'Graph Attention Weights (GAT) + Saliency maps for model interpretability (Paper §5.2)')
        ),
        e('div', { className: 'two-col' },
          e(ChartBox, {}, e('h3', {}, 'Global Feature Importance'),
            e(BarChart, {
              labels: (xai?.globalFeatureImportance || []).map(f => f.feature.split(' ').slice(0, 2).join(' ')),
              data: (xai?.globalFeatureImportance || []).map(f => +(f.importance * 100).toFixed(1)),
              label: 'Importance %', color: '#8b5cf6', height: 280, yMax: 35
            })
          ),
          e(ChartBox, {}, e('h3', {}, 'GNN Layer Attention Weights'),
            e(BarChart, {
              labels: (xai?.gnnLayerWeights || []).map(l => l.layer),
              data: (xai?.gnnLayerWeights || []).map(l => +(l.avgAttention * 100).toFixed(1)),
              label: 'Avg Attention %', color: '#0ea5a4', height: 280
            })
          )
        ),
        e('div', { className: 'two-col' },
          e('div', { className: 'card' },
            e('h3', {}, 'Node Attention (GAT Heads)'),
            (xai?.nodeAttention || []).length === 0 ? e(EmptyState, { msg: 'Select a machine for per-asset attention weights' }) :
            e(DataTable, {
              columns: [
                { key: 'node', label: 'Graph Node' },
                { key: 'attention', label: 'Attention Weight', render: r => e(HealthBar, { value: Math.round(r.attention * 100) }) }
              ],
              rows: xai?.nodeAttention || []
            })
          ),
          e('div', { className: 'card' },
            e('h3', {}, 'Sensor Saliency Map'),
            (xai?.saliencyMap || []).length === 0 ? e(EmptyState, { msg: 'Select a machine for sensor saliency' }) :
            e(DataTable, {
              columns: [
                { key: 'sensor', label: 'Sensor' },
                { key: 'saliency', label: 'Saliency', render: r => e('span', { style: { color: r.saliency > 0.6 ? '#ef4444' : '#0f172a', fontWeight: 700 } }, (r.saliency * 100).toFixed(1) + '%') }
              ],
              rows: xai?.saliencyMap || []
            })
          )
        )
      )
    );
  }

  // ── Ablation Studies ──
  function AblationPage({ data, shell }) {
    const { data: ablations, loading } = useFetch('/api/research/ablation');
    const full = (ablations || []).find(a => a.config.includes('Full Model'));
    return e(ResearchPageShell, { title: 'Ablation Studies', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'card' },
          e('h3', {}, 'Component Ablation (Paper Table III)'),
          e('p', { className: 'muted', style: { marginBottom: 16 } }, 'Systematic removal of architectural components to validate design choices. Full model: F1=' + (full?.f1 || '—') + ', RUL MAE=' + (full?.rulMae || '—') + 'h'),
          e(DataTable, {
            columns: [
              { key: 'config', label: 'Configuration' },
              { key: 'f1', label: 'F1 Score', render: r => r.f1.toFixed(3) },
              { key: 'rulMae', label: 'RUL MAE (hrs)' },
              { key: 'delta', label: 'Δ vs Full', render: r => e('span', { style: { color: r.delta.startsWith('-') ? '#ef4444' : '#10b981', fontWeight: 600 } }, r.delta) }
            ],
            rows: ablations || []
          })
        ),
        e(ChartBox, {}, e('h3', {}, 'F1 Score Impact of Ablations'),
          e(BarChart, {
            labels: (ablations || []).map(a => a.config.replace('w/o ', '−').slice(0, 18)),
            data: (ablations || []).map(a => a.f1 * 100),
            label: 'F1 × 100', color: '#6366f1', height: 300, yMax: 100
          })
        )
      )
    );
  }

  // ── Research Datasets ──
  function ResearchDatasetsPage({ data, shell }) {
    const { data: datasets, loading } = useFetch('/api/research/datasets');
    return e(ResearchPageShell, { title: 'Research Datasets', org: data.organization, shell },
      loading ? e(LoadingState) : e('div', { className: 'page-grid' },
        e('div', { className: 'card' },
          e('h3', {}, 'Dataset Catalog'),
          e(DataTable, {
            columns: [
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Dataset' },
              { key: 'samples', label: 'Samples', render: r => r.samples.toLocaleString('en-IN') },
              { key: 'machines', label: 'Assets' },
              { key: 'sensors', label: 'Sensors' },
              { key: 'split', label: 'Split' },
              { key: 'frequency', label: 'Freq' },
              { key: 'license', label: 'License' }
            ],
            rows: datasets || []
          })
        ),
        e('div', { className: 'dataset-cards' },
          (datasets || []).map(d => e('div', { key: d.id, className: 'card dataset-card' },
            e('h4', {}, d.name),
            e('div', { className: 'muted' }, d.duration + ' · ' + d.frequency),
            e('div', { className: 'dataset-stats' },
              e('div', {}, e('strong', {}, (d.samples / 1000000).toFixed(1) + 'M'), e('div', { className: 'muted' }, 'samples')),
              e('div', {}, e('strong', {}, d.machines), e('div', { className: 'muted' }, 'machines')),
              e('div', {}, e('strong', {}, d.sensors), e('div', { className: 'muted' }, 'sensors'))
            ),
            e('div', { className: 'citation' }, 'Citation: ' + d.citation)
          ))
        )
      )
    );
  }

  // ── Lab Notebook ──
  function LabNotebookPage({ data, shell }) {
    const { data: notes, loading, refetch } = useFetch('/api/research/notebook');
    const [form, setForm] = useState({ title: '', content: '', tag: 'Note', author: 'Researcher' });
    const [saving, setSaving] = useState(false);

    function addNote() {
      if (!form.title.trim()) return;
      setSaving(true);
      fetch('/api/research/notebook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }).then(() => { setForm({ title: '', content: '', tag: 'Note', author: 'Researcher' }); refetch(); setSaving(false); });
    }

    return e(ResearchPageShell, { title: 'Lab Notebook', org: data.organization, shell },
      e('div', { className: 'page-grid' },
        e('div', { className: 'card' },
          e('h3', {}, 'New Research Entry'),
          e('div', { className: 'notebook-form' },
            e('input', { className: 'input', placeholder: 'Title', value: form.title, onChange: ev => setForm(f => ({ ...f, title: ev.target.value })) }),
            e('select', { className: 'select', value: form.tag, onChange: ev => setForm(f => ({ ...f, tag: ev.target.value })) },
              ['Note', 'Finding', 'Experiment', 'Hypothesis', 'Data', 'Deployment', 'Review'].map(t => e('option', { key: t, value: t }, t))),
            e('textarea', { className: 'textarea', placeholder: 'Observations, methodology notes, findings…', value: form.content, onChange: ev => setForm(f => ({ ...f, content: ev.target.value })), rows: 4 }),
            e('button', { className: 'btn', onClick: addNote, disabled: saving }, saving ? 'Saving…' : 'Add Entry')
          )
        ),
        loading ? e(LoadingState) : e('div', { className: 'notebook-list' },
          (notes || []).length === 0 ? e(EmptyState, { msg: 'No notebook entries yet' }) :
          (notes || []).map(n => e('div', { key: n.id, className: 'card notebook-entry' },
            e('div', { className: 'notebook-entry-header' },
              e(ResearchBadge, { text: n.tag }),
              e('span', { className: 'muted' }, n.date + ' · ' + n.author)
            ),
            e('h4', {}, n.title),
            e('p', {}, n.content)
          ))
        )
      )
    );
  }

  window.InduGraphResearch = {
    ResearchLabPage, ComputeClusterPage, HyperparamSearchPage, CrossValidationPage,
    ModelRegistryPage, FeatureDriftPage, GraphAnalyticsPage, ResearchPipelinePage,
    ExperimentsPage, BenchmarksPage, ExplainabilityPage,
    AblationPage, ResearchDatasetsPage, LabNotebookPage
  };
})();
