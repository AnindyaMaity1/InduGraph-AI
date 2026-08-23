/* InduGraph AI — Core utilities, hooks & shared components */
const e = React.createElement;
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const DEFAULT_SETTINGS = {
  emailAlerts: true, criticalOnly: false, refreshInterval: 30,
  alertThreshold: 70, units: 'metric', timezone: 'Asia/Kolkata'
};

const NAV_ITEMS = [
  'Overview', 'Factory', 'Machines', 'Live Monitoring', 'Sensor Data',
  'GNN Graph', 'Predictive Maintenance', 'Fault Diagnosis', 'Anomaly Detection',
  'RUL Prediction', 'Analytics', 'Alerts', 'Reports'
];

const RESEARCH_NAV_ITEMS = [
  'Research Lab', 'Experiments', 'Cross Validation', 'Model Registry',
  'Benchmarks', 'Explainability', 'Ablation Studies', 'Feature Drift',
  'Compute Cluster', 'Graph Analytics', 'Research Pipeline',
  'Research Datasets', 'Lab Notebook'
];

const RESEARCH_ROUTES = new Set(RESEARCH_NAV_ITEMS.map(routeHash));

const STATUS_COLORS = { operational: '#10b981', degraded: '#f59e0b', critical: '#ef4444' };
const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6' };

function formatINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

function formatIST(iso, tz) {
  try {
    return new Date(iso).toLocaleString('en-IN', { timeZone: tz || 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) { return iso; }
}

function healthColor(h) {
  if (h >= 80) return '#10b981';
  if (h >= 60) return '#f59e0b';
  return '#ef4444';
}

function routeHash(name) { return name.replace(/\s+/g, ''); }

function useFetch(url, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : 'HTTP ' + r.status);
      return r.json();
    }).then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, deps ? [...deps, url, tick] : [url, tick]);
  return { data, loading, error, refetch };
}

function useData() {
  const [data, setData] = useState({ factories: [], machines: [], organization: {}, maintenanceTasks: [] });
  const reload = useCallback(() => {
    fetch('/api/sample-data').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return [data, reload];
}

function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('indugraph-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (_) { return { ...DEFAULT_SETTINGS }; }
  });
  function update(patch) {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('indugraph-settings', JSON.stringify(next));
      return next;
    });
  }
  return [settings, update];
}

function useLiveStream(enabled) {
  const [live, setLive] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource('/api/live/stream');
    es.onmessage = ev => { try { setLive(JSON.parse(ev.data)); } catch (_) {} };
    es.onerror = () => es.close();
    return () => es.close();
  }, [enabled]);
  return live;
}

function useChart(ref, config, deps) {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    const ctx = ref.current.getContext('2d');
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ctx, config);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, deps);
}

const PUBLICATION_EXPORT_WIDTH = 6000;  // ~20" at 300 DPI — IEEE / conference print
const PUBLICATION_MIN_HEIGHT = 2400;
const PUBLICATION_SUPERSAMPLE = 2;      // 2× SSAA internal render → sharp downsample
const MAX_RENDER_DIMENSION = 16384;     // Chrome canvas limit

function triggerPngDownload(dataUrl, filename) {
  const name = (filename || 'indugraph-chart').replace(/\.png$/i, '') + '.png';
  const link = document.createElement('a');
  link.download = name;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function compositeWhitePng(sourceCanvas, outW, outH) {
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, outW, outH);
  }
  return out;
}

function createOffscreenChartHost(w, h) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-30000px;top:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;width:' + w + 'px;height:' + h + 'px';
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  host.appendChild(canvas);
  document.body.appendChild(host);
  return {
    canvas,
    destroy(chart) {
      if (chart) chart.destroy();
      host.remove();
    }
  };
}

function exportChartJsPublication(chart, filename) {
  const displayW = chart.canvas.clientWidth || chart.width || 400;
  const displayH = chart.canvas.clientHeight || chart.height || 280;
  const dims = getPublicationDimensions(displayW, displayH);
  const host = createOffscreenChartHost(dims.renderW, dims.renderH);
  let tmpChart;

  try {
    tmpChart = new Chart(host.canvas.getContext('2d'), {
      type: chart.config.type,
      data: scaleChartDataForExport(JSON.parse(JSON.stringify(chart.data)), dims.fontScale),
      options: buildPublicationChartOptions(JSON.parse(JSON.stringify(chart.options)), dims.renderW, dims.renderH, dims.fontScale)
    });
    if (typeof tmpChart.resize === 'function') tmpChart.resize(dims.renderW, dims.renderH);
    tmpChart.update('none');
  } catch (_) {
    host.destroy(tmpChart);
    exportCanvasPublication(chart.canvas, filename);
    return;
  }

  setTimeout(() => {
    try {
      const out = compositeWhitePng(host.canvas, dims.targetW, dims.targetH);
      triggerPngDownload(out.toDataURL('image/png', 1.0), filename);
    } finally {
      host.destroy(tmpChart);
    }
  }, 350);
}

function exportCanvasPublication(canvas, filename) {
  const displayW = canvas.clientWidth || canvas.width || 400;
  const displayH = canvas.clientHeight || canvas.height || 280;
  const dims = getPublicationDimensions(displayW, displayH);
  const hi = document.createElement('canvas');
  hi.width = dims.renderW;
  hi.height = dims.renderH;
  const hctx = hi.getContext('2d');
  hctx.fillStyle = '#ffffff';
  hctx.fillRect(0, 0, dims.renderW, dims.renderH);
  hctx.imageSmoothingEnabled = true;
  hctx.imageSmoothingQuality = 'high';
  hctx.drawImage(canvas, 0, 0, dims.renderW, dims.renderH);
  const out = compositeWhitePng(hi, dims.targetW, dims.targetH);
  triggerPngDownload(out.toDataURL('image/png', 1.0), filename);
}

function getPublicationDimensions(displayW, displayH) {
  const targetW = PUBLICATION_EXPORT_WIDTH;
  const targetH = Math.max(PUBLICATION_MIN_HEIGHT, Math.round(targetW * (displayH / Math.max(displayW, 1))));
  let renderW = targetW * PUBLICATION_SUPERSAMPLE;
  let renderH = targetH * PUBLICATION_SUPERSAMPLE;
  const maxDim = Math.max(renderW, renderH);
  if (maxDim > MAX_RENDER_DIMENSION) {
    const scale = MAX_RENDER_DIMENSION / maxDim;
    renderW = Math.round(renderW * scale);
    renderH = Math.round(renderH * scale);
  }
  const fontScale = renderW / Math.max(displayW, 1);
  return { targetW, targetH, renderW, renderH, fontScale };
}

function buildPublicationChartOptions(options, width, height, fontScale) {
  const opts = JSON.parse(JSON.stringify(options || {}));
  opts.responsive = false;
  opts.maintainAspectRatio = false;
  opts.animation = false;
  opts.devicePixelRatio = 1;
  opts.plugins = opts.plugins || {};
  opts.plugins.legend = opts.plugins.legend || {};
  if (opts.plugins.legend.display !== false) {
    opts.plugins.legend.position = opts.plugins.legend.position || 'bottom';
    opts.plugins.legend.labels = opts.plugins.legend.labels || {};
    opts.plugins.legend.labels.font = {
      size: Math.round(14 * fontScale),
      family: 'Inter, Arial, Helvetica, sans-serif',
      weight: '500'
    };
    opts.plugins.legend.labels.boxWidth = Math.round(22 * fontScale);
    opts.plugins.legend.labels.padding = Math.round(16 * fontScale);
  }
  opts.scales = opts.scales || {};
  Object.keys(opts.scales).forEach(axis => {
    const scale = opts.scales[axis];
    if (!scale) return;
    scale.ticks = scale.ticks || {};
    scale.ticks.font = {
      size: Math.round(13 * fontScale),
      family: 'Inter, Arial, Helvetica, sans-serif'
    };
    if (scale.title) {
      scale.title.font = {
        size: Math.round(14 * fontScale),
        family: 'Inter, Arial, Helvetica, sans-serif',
        weight: '600'
      };
    }
    if (scale.grid) scale.grid.lineWidth = Math.max(1, Math.round(fontScale * 0.08));
    if (scale.border) scale.border.lineWidth = Math.max(1, Math.round(fontScale * 0.06));
  });
  return opts;
}

function scaleChartDataForExport(data, fontScale) {
  const d = JSON.parse(JSON.stringify(data));
  (d.datasets || []).forEach(ds => {
    const stroke = Math.max(3, Math.round(fontScale * 0.45));
    if (ds.borderWidth != null) ds.borderWidth = stroke;
    else if (ds.type !== 'bar') ds.borderWidth = stroke;
    if (ds.pointRadius != null) ds.pointRadius = Math.max(3, Math.round(fontScale * 0.35));
    if (ds.pointHoverRadius != null) ds.pointHoverRadius = Math.max(4, Math.round(fontScale * 0.45));
    if (ds.borderRadius != null) ds.borderRadius = Math.max(6, Math.round(fontScale * 0.55));
    if (ds.barThickness != null) ds.barThickness = Math.round(ds.barThickness * fontScale * 0.08);
  });
  return d;
}

function downloadCanvasAsPng(canvas, filename) {
  if (!canvas || typeof canvas.toDataURL !== 'function') return;
  if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
    const chart = Chart.getChart(canvas);
    if (chart) {
      exportChartJsPublication(chart, filename);
      return;
    }
  }
  exportCanvasPublication(canvas, filename);
}

function downloadVisNetworkPublication(network, container, filename) {
  if (!network || !container) return;
  const rect = container.getBoundingClientRect();
  const dims = getPublicationDimensions(rect.width, rect.height);
  const prevWidth = container.style.width;
  const prevHeight = container.style.height;

  container.style.width = dims.renderW + 'px';
  container.style.height = dims.renderH + 'px';
  network.setSize(dims.renderW + 'px', dims.renderH + 'px');
  network.stabilize();
  network.redraw();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const canvas = container.querySelector('canvas');
          if (canvas && canvas.width > 0 && canvas.height > 0) {
            const out = compositeWhitePng(canvas, dims.targetW, dims.targetH);
            triggerPngDownload(out.toDataURL('image/png', 1.0), filename);
          }
        } finally {
          container.style.width = prevWidth;
          container.style.height = prevHeight;
          network.setSize('100%', '100%');
          network.redraw();
          network.fit({ animation: false });
        }
      }, 1200);
    });
  });
}

function ChartContainer({ height, children, downloadName }) {
  const wrapRef = useRef();
  const [exporting, setExporting] = useState(false);
  function handleDownload() {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas || exporting) return;
    setExporting(true);
    setTimeout(() => {
      try {
        downloadCanvasAsPng(canvas, downloadName || 'indugraph-chart-' + Date.now());
      } finally {
        setTimeout(() => setExporting(false), 3000);
      }
    }, 30);
  }
  return e('div', { className: 'chart-wrap' },
    e('button', {
      type: 'button',
      className: 'chart-download-btn',
      title: 'Download ultra-high-res PNG (6000px, 300 DPI, white background)',
      onClick: handleDownload,
      disabled: exporting
    }, exporting ? 'Exporting…' : '↓ Download'),
    e('div', { ref: wrapRef, className: 'chart-container', style: { height: height || 240 } }, children)
  );
}

function SettingsIcon() {
  return e('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    e('circle', { cx: 12, cy: 12, r: 3 }),
    e('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' })
  );
}

function SettingsDropdown({ settings, onUpdate, org }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const fn = ev => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  return e('div', { className: 'settings-menu', ref },
    e('button', { className: 'settings-btn' + (open ? ' active' : ''), onClick: () => setOpen(v => !v), title: 'Settings', 'aria-label': 'Settings' }, e(SettingsIcon)),
    open && e('div', { className: 'settings-dropdown settings-panel' },
      e('div', { className: 'settings-dropdown-header' }, 'Settings'),
      e('div', { className: 'settings-group' },
        e('div', { className: 'settings-group-title' }, 'Notifications'),
        e('label', { className: 'settings-row' }, e('span', {}, 'Email alerts'), e('input', { type: 'checkbox', checked: settings.emailAlerts, onChange: ev => onUpdate({ emailAlerts: ev.target.checked }) })),
        e('label', { className: 'settings-row' }, e('span', {}, 'Critical only'), e('input', { type: 'checkbox', checked: settings.criticalOnly, onChange: ev => onUpdate({ criticalOnly: ev.target.checked }) })),
        e('label', { className: 'settings-field settings-field-inline' }, e('span', {}, 'Alert threshold'),
          e('div', { className: 'settings-range-wrap' },
            e('input', { type: 'range', min: 50, max: 95, step: 5, value: settings.alertThreshold, onChange: ev => onUpdate({ alertThreshold: Number(ev.target.value) }) }),
            e('strong', {}, settings.alertThreshold + '%')))
      ),
      e('div', { className: 'settings-dropdown-divider' }),
      e('div', { className: 'settings-group' },
        e('div', { className: 'settings-group-title' }, 'Monitoring'),
        e('label', { className: 'settings-row settings-row-select' }, e('span', {}, 'Refresh'), e('select', { value: settings.refreshInterval, onChange: ev => onUpdate({ refreshInterval: Number(ev.target.value) }) },
          e('option', { value: 15 }, '15s'), e('option', { value: 30 }, '30s'), e('option', { value: 60 }, '1m'), e('option', { value: 300 }, '5m'))),
        e('label', { className: 'settings-row settings-row-select' }, e('span', {}, 'Timezone'), e('select', { value: settings.timezone, onChange: ev => onUpdate({ timezone: ev.target.value }) },
          e('option', { value: 'Asia/Kolkata' }, 'IST'), e('option', { value: 'UTC' }, 'UTC')))
      ),
      e('div', { className: 'settings-dropdown-divider' }),
      e('div', { className: 'settings-group' },
        e('div', { className: 'settings-group-title' }, 'Account'),
        e('div', { className: 'settings-info-row' }, e('span', { className: 'muted' }, 'Org'), e('span', {}, (org && org.name) || 'Bharat Precision Industries')),
        e('div', { className: 'settings-info-row' }, e('span', { className: 'muted' }, 'GSTIN'), e('span', {}, (org && org.gstin) || '—')),
        e('div', { className: 'settings-actions' },
          e('button', { className: 'settings-action-btn accent', onClick: () => onUpdate({ ...DEFAULT_SETTINGS }) }, 'Reset'))
      )
    )
  );
}

function GlobalSearchBar({ query, onChange, data, onSelectMachine, onNavigateFactory }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const results = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { machines: [], factories: [] };
    const machines = (data?.machines || []).filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.type || '').toLowerCase().includes(q) ||
      (m.line || '').toLowerCase().includes(q)
    ).slice(0, 6);
    const factories = (data?.factories || []).filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.location || '').toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    ).slice(0, 4);
    return { machines, factories };
  }, [query, data]);

  const hasResults = results.machines.length > 0 || results.factories.length > 0;

  useEffect(() => {
    if (!open) return;
    const fn = ev => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  function pickMachine(m) {
    onSelectMachine(m.id);
    setOpen(false);
    onChange('');
  }

  function pickFactory(f) {
    onNavigateFactory(f.id);
    setOpen(false);
    onChange('');
  }

  function onKeyDown(ev) {
    if (ev.key === 'Escape') setOpen(false);
    if (ev.key === 'Enter' && hasResults) {
      ev.preventDefault();
      if (results.machines[0]) pickMachine(results.machines[0]);
      else if (results.factories[0]) pickFactory(results.factories[0]);
    }
  }

  return e('div', { className: 'search-wrap', ref },
    e('input', {
      className: 'search',
      placeholder: 'Search machines, factories...',
      value: query || '',
      onChange: ev => { onChange(ev.target.value); setOpen(true); },
      onFocus: () => setOpen(true),
      onKeyDown,
      'aria-label': 'Search machines and factories',
      'aria-expanded': open && !!query
    }),
    open && query && e('div', { className: 'search-dropdown', role: 'listbox' },
      !hasResults && e('div', { className: 'search-empty muted' }, 'No results for "' + query + '"'),
      results.machines.length > 0 && e('div', { className: 'search-group' },
        e('div', { className: 'search-group-title' }, 'Machines'),
        results.machines.map(m => e('button', {
          key: m.id, type: 'button', className: 'search-item', role: 'option',
          onClick: () => pickMachine(m)
        },
          e('span', { className: 'search-item-title' }, m.name),
          e('span', { className: 'search-item-meta muted' }, m.id + ' · ' + m.health + '% · ' + m.status)
        ))
      ),
      results.factories.length > 0 && e('div', { className: 'search-group' },
        e('div', { className: 'search-group-title' }, 'Factories'),
        results.factories.map(f => e('button', {
          key: f.id, type: 'button', className: 'search-item', role: 'option',
          onClick: () => pickFactory(f)
        },
          e('span', { className: 'search-item-title' }, f.name),
          e('span', { className: 'search-item-meta muted' }, f.location)
        ))
      )
    )
  );
}

function Header({ title, settings, onUpdateSettings, org, data, searchQuery, onSearchChange, onSelectMachine, onNavigateFactory, onOpenResearchLab }) {
  return e('div', { className: 'header' },
    e('div', { className: 'header-left' },
      e('div', { className: 'page-title' }, title),
      e('div', { className: 'page-subtitle muted' }, 'Bharat Precision Industries · Make in India')
    ),
    e('div', { className: 'header-actions' },
      e(GlobalSearchBar, {
        query: searchQuery,
        onChange: onSearchChange,
        data,
        onSelectMachine,
        onNavigateFactory
      }),
      onOpenResearchLab && e('button', {
        className: 'btn-research-lab',
        onClick: onOpenResearchLab,
        title: 'Open Research Lab dashboard'
      }, 'Open Research Lab'),
      e('div', { className: 'live-indicator' }, e('span', { className: 'live-dot' }), 'Live'),
      e(SettingsDropdown, { settings, onUpdate: onUpdateSettings, org })
    )
  );
}

function ResearchHeader({ title, settings, onUpdateSettings, org, onExitResearch }) {
  return e('div', { className: 'header' },
    e('div', { className: 'header-left' },
      e('div', { className: 'page-title' }, title),
      e('div', { className: 'page-subtitle muted' }, 'InduGraph Research Lab · CIAIR IIT Bombay')
    ),
    e('div', { className: 'header-actions' },
      e('button', { className: 'btn secondary btn-sm', onClick: onExitResearch }, '← Main Dashboard'),
      e(SettingsDropdown, { settings, onUpdate: onUpdateSettings, org })
    )
  );
}

function Sidebar({ onNav, current }) {
  return e('div', { className: 'sidebar' },
    e('div', { className: 'brand' },
      e('div', { className: 'brand-icon' }, 'IG'),
      e('div', {}, e('div', { className: 'brand-name' }, 'InduGraph AI'), e('div', { className: 'brand-tag' }, 'Predictive Maintenance'))
    ),
    e('nav', { className: 'nav' }, NAV_ITEMS.map(it =>
      e('a', {
        key: it, href: '#' + routeHash(it),
        className: current === routeHash(it) ? 'active' : '',
        onClick: ev => { ev.preventDefault(); onNav(it); }
      }, it)
    )),
    e('div', { className: 'sidebar-footer' },
      e('div', { className: 'muted', style: { fontSize: 11 } }, 'GNN-Maintenance-v2.1'),
      e('div', { className: 'muted', style: { fontSize: 11 } }, 'Region: ap-south-1')
    )
  );
}

function ResearchSidebar({ onNav, current }) {
  return e('div', { className: 'sidebar research-sidebar' },
    e('div', { className: 'brand' },
      e('div', { className: 'brand-icon research-brand-icon' }, 'RL'),
      e('div', {}, e('div', { className: 'brand-name' }, 'Research Lab'), e('div', { className: 'brand-tag' }, 'GNN Research Platform'))
    ),
    e('nav', { className: 'nav' }, RESEARCH_NAV_ITEMS.map(it =>
      e('a', {
        key: it, href: '#research/' + routeHash(it),
        className: current === routeHash(it) ? 'active' : '',
        onClick: ev => { ev.preventDefault(); onNav(it); }
      }, it)
    )),
    e('div', { className: 'sidebar-footer' },
      e('div', { className: 'muted', style: { fontSize: 11 } }, 'CIAIR · IIT Bombay'),
      e('div', { className: 'muted', style: { fontSize: 11 } }, 'InduGraph-GNN v2.1')
    )
  );
}

function KPICard({ title, value, muted, trend, color }) {
  return e('div', { className: 'kpi-card' },
    e('div', { className: 'kpi-label' }, title),
    e('div', { className: 'kpi-value', style: color ? { color } : {} }, value),
    muted && e('div', { className: 'kpi-muted' }, muted),
    trend && e('div', { className: 'kpi-trend ' + (trend > 0 ? 'up' : 'down') }, (trend > 0 ? '↑' : '↓') + ' ' + Math.abs(trend) + '%')
  );
}

function SeverityBadge({ severity }) {
  return e('span', { className: 'badge badge-' + severity }, severity);
}

function StatusBadge({ status }) {
  return e('span', { className: 'badge badge-' + status, style: { background: STATUS_COLORS[status] + '20', color: STATUS_COLORS[status] } }, status);
}

function HealthBar({ value }) {
  return e('div', { className: 'health-bar' },
    e('div', { className: 'health-bar-fill', style: { width: value + '%', background: healthColor(value) } }),
    e('span', { className: 'health-bar-text' }, value + '%')
  );
}

function LoadingState() { return e('div', { className: 'loading-state' }, 'Loading...'); }

function EmptyState({ msg }) { return e('div', { className: 'empty-state muted' }, msg || 'No data available'); }

function ChartBox({ height, children }) {
  return e('div', { className: 'card chart-card' }, children);
}

function LineChart({ labels, datasets, height, downloadName }) {
  const ref = useRef();
  const h = height || 240;
  useChart(ref, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: false } }
    }
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);
  return e(ChartContainer, { height: h, downloadName }, e('canvas', { ref }));
}

function BarChart({ labels, data, label, color, height, yMax, downloadName }) {
  const ref = useRef();
  const h = height || 240;
  const barColors = Array.isArray(color) ? color : (color || '#0ea5a4');
  useChart(ref, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: barColors, borderRadius: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: yMax ? { y: { min: 0, max: yMax } } : undefined
    }
  }, [JSON.stringify(labels), JSON.stringify(data), JSON.stringify(barColors), yMax]);
  return e(ChartContainer, { height: h, downloadName }, e('canvas', { ref }));
}

function DoughnutChart({ labels, data, height, downloadName }) {
  const ref = useRef();
  const h = height || 200;
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6'];
  useChart(ref, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, data.length) }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false }
  }, [JSON.stringify(labels), JSON.stringify(data)]);
  return e(ChartContainer, { height: h, downloadName }, e('canvas', { ref }));
}

function DataTable({ columns, rows, onRowClick }) {
  return e('div', { className: 'table-wrap' },
    e('table', { className: 'table' },
      e('thead', {}, e('tr', {}, columns.map(c => e('th', { key: c.key }, c.label)))),
      e('tbody', {}, rows.map((row, i) =>
        e('tr', { key: row.id || i, className: onRowClick ? 'clickable' : '', onClick: () => onRowClick && onRowClick(row) },
          columns.map(c => e('td', { key: c.key }, c.render ? c.render(row) : row[c.key]))
        )
      ))
    )
  );
}

function PageShell({ title, org, shell, children }) {
  return e('div', { className: 'page' },
    e(Header, { title, org: org || shell?.data?.organization, ...shell }),
    children
  );
}

function ResearchPageShell({ title, shell, children }) {
  return e('div', { className: 'page' },
    e(ResearchHeader, { title, org: shell?.data?.organization, ...shell }),
    children
  );
}

window.InduGraph = {
  e, useState, useEffect, useRef, useCallback, useMemo,
  formatINR, formatIST, healthColor, routeHash, STATUS_COLORS, SEV_COLORS,
  useFetch, useData, useSettings, useLiveStream, useChart,
  Sidebar, ResearchSidebar, Header, ResearchHeader, GlobalSearchBar, KPICard, SeverityBadge, StatusBadge, HealthBar,
  LoadingState, EmptyState, ChartBox, ChartContainer, LineChart, BarChart, DoughnutChart,
  downloadCanvasAsPng, downloadVisNetworkPublication,
  DataTable, PageShell, ResearchPageShell, NAV_ITEMS, RESEARCH_NAV_ITEMS, RESEARCH_ROUTES
};
