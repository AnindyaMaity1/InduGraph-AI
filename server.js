const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use('/vendor/react', express.static(path.join(__dirname, 'node_modules/react/umd')));
app.use('/vendor/react-dom', express.static(path.join(__dirname, 'node_modules/react-dom/umd')));
app.use('/vendor/vis-network', express.static(path.join(__dirname, 'node_modules/vis-network/standalone/umd')));

let organization = {};
let factories = [];
let machines = [];
let maintenanceTasks = [];
let alerts = [];
let reports = [];
let uploadedDatasets = [];
let research = {};

const FAULT_TYPES = {
  bearing_wear: { label: 'Bearing Wear', action: 'Replace bearings within 72 hours', severity: 'critical' },
  belt_misalignment: { label: 'Belt Misalignment', action: 'Realign conveyor belt and inspect rollers', severity: 'high' },
  seal_degradation: { label: 'Seal Degradation', action: 'Inspect and replace compressor seals', severity: 'high' },
  electrode_wear: { label: 'Electrode Wear', action: 'Replace welding electrodes and recalibrate', severity: 'medium' },
  motor_overload: { label: 'Motor Overload', action: 'Reduce load and inspect motor windings', severity: 'high' },
  thermal_runaway: { label: 'Thermal Runaway Risk', action: 'Shut down and inspect cooling system', severity: 'critical' }
};

function loadData() {
  try {
    const sample = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'sample.json'), 'utf8'));
    organization = sample.organization || {};
    factories = sample.factories || [];
    machines = (sample.machines || []).map(enrichMachine);
    maintenanceTasks = sample.maintenanceTasks || [];
    alerts = generateAlerts();
    try {
      research = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'research.json'), 'utf8'));
    } catch (_) { research = {}; }
  } catch (err) {
    console.error('Failed to load sample data:', err.message);
  }
}

function enrichMachine(m) {
  return {
    ...m,
    alerts: [],
    updatedAt: new Date().toISOString()
  };
}

function buildGnnAnalysis(m) {
  const fault = (m.faults || [])[0];
  const ft = fault ? FAULT_TYPES[fault.type] : null;
  const breached = (m.sensors || []).filter(s => s.threshold && s.latest > s.threshold);
  const topSensors = breached.length ? breached : (m.sensors || []).slice(0, 3);
  const attentionPath = fault
    ? ['Plant Graph', m.factoryId || 'Factory', m.id, ...topSensors.map(s => s.type), fault.type]
    : ['Plant Graph', m.factoryId || 'Factory', m.id, 'Normal State'];
  return {
    modelVersion: 'InduGraph-GNN v2.1',
    inferenceLatencyMs: 38 + (m.id.charCodeAt(m.id.length - 1) % 12),
    graphNodes: 12 + (m.sensors || []).length * 2,
    graphEdges: 18 + (m.sensors || []).length * 3,
    attentionPath,
    topContributors: topSensors.map((s, i) => ({
      sensor: s.type,
      value: s.latest,
      unit: s.unit,
      weight: +(0.22 - i * 0.04 + (m.anomalyScore || 0) * 0.3).toFixed(2),
      breached: !!(s.threshold && s.latest > s.threshold)
    })),
    severity: ft?.severity || (m.anomalyScore > 0.4 ? 'medium' : 'low'),
    recommendedAction: ft?.action || 'Continue routine monitoring — no active fault signature',
    rulImpactHours: fault ? Math.max(24, Math.round((m.rulHours || 0) * 0.18)) : 0,
    failureMode: fault ? (ft?.label || fault.type.replace(/_/g, ' ')) : 'None detected',
    embeddingDrift: +(m.anomalyScore * 0.82).toFixed(2),
    messagePassingLayers: 4,
    neighborMachines: 3 + (m.id.charCodeAt(2) % 4)
  };
}

function generateAlerts() {
  const now = Date.now();
  const list = [];
  machines.forEach((m, i) => {
    if (m.health < 70) {
      list.push({
        id: 'AL-' + m.id,
        machineId: m.id,
        machineName: m.name,
        factoryId: m.factoryId,
        severity: m.health < 60 ? 'critical' : 'high',
        category: 'health',
        text: `Health dropped to ${m.health}% — immediate attention required`,
        status: 'open',
        time: new Date(now - i * 3600000).toISOString()
      });
    }
    (m.faults || []).forEach((f, j) => {
      const ft = FAULT_TYPES[f.type] || { label: f.type, action: 'Inspect machine', severity: 'medium' };
      list.push({
        id: 'AL-F-' + m.id + '-' + j,
        machineId: m.id,
        machineName: m.name,
        factoryId: m.factoryId,
        severity: ft.severity,
        category: 'fault',
        text: `${ft.label} detected (${Math.round(f.probability * 100)}% probability)`,
        recommendation: ft.action,
        status: 'open',
        time: new Date(now - (i + j + 1) * 1800000).toISOString()
      });
    });
    if (m.anomalyScore > 0.5) {
      list.push({
        id: 'AL-AN-' + m.id,
        machineId: m.id,
        machineName: m.name,
        factoryId: m.factoryId,
        severity: m.anomalyScore > 0.8 ? 'critical' : 'medium',
        category: 'anomaly',
        text: `Anomaly score ${Math.round(m.anomalyScore * 100)}% — pattern deviation detected`,
        status: 'open',
        time: new Date(now - i * 7200000).toISOString()
      });
    }
  });
  return list.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function simulateTelemetry() {
  machines = machines.map(m => {
    const readings = { ...(m.readings || {}) };
    Object.keys(readings).forEach(key => {
      const arr = [...readings[key]];
      const last = arr[arr.length - 1] || 0;
      const drift = (Math.random() - 0.48) * (last * 0.02 + 0.1);
      arr.push(Math.max(0, +(last + drift).toFixed(2)));
      if (arr.length > 30) arr.shift();
      readings[key] = arr;
    });
    const sensors = (m.sensors || []).map(s => {
      const r = readings[s.type];
      return { ...s, latest: r ? r[r.length - 1] : s.latest };
    });
    const healthDelta = m.status === 'critical' ? -0.3 : (Math.random() > 0.7 ? -0.5 : 0.2);
    const health = Math.max(30, Math.min(99, Math.round(m.health + healthDelta)));
    return { ...m, readings, sensors, health, updatedAt: new Date().toISOString() };
  });
}

function getAnalytics() {
  const totalMachines = machines.length;
  const avgHealth = Math.round(machines.reduce((s, m) => s + m.health, 0) / Math.max(1, totalMachines));
  const criticalCount = machines.filter(m => m.health < 60).length;
  const degradedCount = machines.filter(m => m.status === 'degraded' || m.status === 'critical').length;
  const avgOEE = +(factories.reduce((s, f) => s + f.oee, 0) / Math.max(1, factories.length)).toFixed(1);
  const avgUptime = +(factories.reduce((s, f) => s + f.uptime, 0) / Math.max(1, factories.length)).toFixed(1);
  const openAlerts = alerts.filter(a => a.status === 'open');
  const maintenanceCost = maintenanceTasks.reduce((s, t) => s + t.costINR, 0);
  const downtimeCost = machines.filter(m => m.health < 70).reduce((s, m) => s + m.costPerHourINR * 8, 0);

  return {
    kpis: {
      totalMachines,
      totalFactories: factories.length,
      avgHealth,
      avgOEE,
      avgUptime,
      criticalMachines: criticalCount,
      degradedMachines: degradedCount,
      openAlerts: openAlerts.length,
      predictedFailures7d: machines.filter(m => m.rulDays <= 7).length,
      maintenanceCostINR: maintenanceCost,
      estimatedDowntimeCostINR: downtimeCost
    },
    healthTrend: [82, 84, 81, 79, 80, 78, avgHealth],
    oeeByFactory: factories.map(f => ({ name: f.name.split(' ')[0], oee: f.oee })),
    alertsBySeverity: {
      critical: openAlerts.filter(a => a.severity === 'critical').length,
      high: openAlerts.filter(a => a.severity === 'high').length,
      medium: openAlerts.filter(a => a.severity === 'medium').length,
      low: openAlerts.filter(a => a.severity === 'low').length
    },
    costBreakdown: {
      preventive: maintenanceTasks.filter(t => t.type === 'Scheduled').reduce((s, t) => s + t.costINR, 0),
      predictive: maintenanceTasks.filter(t => t.type === 'Predictive').reduce((s, t) => s + t.costINR, 0),
      emergency: maintenanceTasks.filter(t => t.type === 'Emergency').reduce((s, t) => s + t.costINR, 0)
    }
  };
}

loadData();

// ── Health & meta ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/organization', (req, res) => res.json(organization));

// ── Core data ──
app.get('/api/sample-data', (req, res) => {
  res.json({ organization, factories, machines, maintenanceTasks });
});

app.get('/api/factories', (req, res) => {
  const enriched = factories.map(f => ({
    ...f,
    machineCount: machines.filter(m => m.factoryId === f.id).length,
    avgHealth: Math.round(
      machines.filter(m => m.factoryId === f.id).reduce((s, m) => s + m.health, 0) /
      Math.max(1, machines.filter(m => m.factoryId === f.id).length)
    ),
    openAlerts: alerts.filter(a => a.factoryId === f.id && a.status === 'open').length
  }));
  res.json(enriched);
});

app.get('/api/factories/:id', (req, res) => {
  const f = factories.find(x => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Factory not found' });
  const factoryMachines = machines.filter(m => m.factoryId === f.id);
  res.json({ ...f, machines: factoryMachines, alerts: alerts.filter(a => a.factoryId === f.id) });
});

app.post('/api/factories', (req, res) => {
  const f = { id: 'F-' + Date.now(), oee: 0, uptime: 0, capacity: 0, employees: 0, ...req.body };
  factories.push(f);
  res.status(201).json(f);
});

app.get('/api/machines', (req, res) => {
  const { factoryId, status, q } = req.query;
  let result = [...machines];
  if (factoryId) result = result.filter(m => m.factoryId === factoryId);
  if (status) result = result.filter(m => m.status === status);
  if (q) {
    const term = q.toLowerCase();
    result = result.filter(m => m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term));
  }
  res.json(result);
});

app.get('/api/machines/:id', (req, res) => {
  const m = machines.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Machine not found' });
  const factory = factories.find(f => f.id === m.factoryId);
  res.json({ ...m, factory, gnnAnalysis: buildGnnAnalysis(m) });
});

app.post('/api/machines', (req, res) => {
  const m = enrichMachine({ id: 'M-' + Date.now(), health: 95, status: 'operational', sensors: [], readings: {}, faults: [], anomalyScore: 0, ...req.body });
  machines.push(m);
  res.status(201).json(m);
});

// ── Live monitoring (SSE) ──
app.get('/api/live/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = () => {
    simulateTelemetry();
    const payload = {
      timestamp: new Date().toISOString(),
      machines: machines.map(m => ({
        id: m.id, name: m.name, health: m.health, status: m.status,
        sensors: m.sensors, anomalyScore: m.anomalyScore, factoryId: m.factoryId
      }))
    };
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
  };

  send();
  const interval = setInterval(send, 3000);
  req.on('close', () => clearInterval(interval));
});

app.get('/api/live/snapshot', (req, res) => {
  simulateTelemetry();
  res.json({ timestamp: new Date().toISOString(), machines });
});

// ── AI / GNN endpoints ──
app.get('/api/model-status', (req, res) => {
  res.json({
    status: 'deployed',
    name: 'InduGraph-GNN-v2.1',
    version: '2.1.0',
    framework: 'PyTorch Geometric',
    lastTrained: '2026-07-28T10:30:00+05:30',
    accuracy: 94.2,
    f1Score: 0.91,
    inferenceLatencyMs: 45,
    nodesInGraph: machines.length + machines.reduce((s, m) => s + (m.sensors || []).length, 0),
    deployedRegion: 'ap-south-1 (Mumbai)',
    compliance: ['ISO 27001', 'BIS compliant sensors', 'DPDP Act 2023 ready']
  });
});

app.get('/api/gnn/graph', (req, res) => {
  const nodes = [];
  const edges = [];
  factories.forEach(f => {
    nodes.push({ id: f.id, label: f.name, group: 'factory', level: 0 });
    machines.filter(m => m.factoryId === f.id).forEach(m => {
      nodes.push({ id: m.id, label: m.name, group: m.status, level: 1, health: m.health });
      edges.push({ from: f.id, to: m.id, type: 'contains' });
      (m.sensors || []).forEach(s => {
        const sid = m.id + '-' + s.id;
        nodes.push({ id: sid, label: s.type, group: 'sensor', level: 2 });
        edges.push({ from: m.id, to: sid, type: 'monitors' });
      });
      machines.filter(other => other.factoryId === f.id && other.id !== m.id).slice(0, 1).forEach(other => {
        edges.push({ from: m.id, to: other.id, type: 'correlates', dashes: true });
      });
    });
  });
  res.json({ nodes, edges });
});

app.get('/api/predictive-maintenance', (req, res) => {
  res.json({
    tasks: maintenanceTasks,
    predictions: machines.map(m => ({
      machineId: m.id,
      machineName: m.name,
      factoryId: m.factoryId,
      health: m.health,
      rulHours: m.rulHours,
      rulDays: m.rulDays,
      failureProbability: Math.round((100 - m.health) * 0.85),
      recommendedAction: m.rulDays <= 7 ? 'Schedule immediate inspection' : m.rulDays <= 14 ? 'Plan maintenance within 2 weeks' : 'Monitor — within normal range',
      estimatedCostINR: m.rulDays <= 7 ? m.costPerHourINR * 24 : m.costPerHourINR * 8
    })).sort((a, b) => a.rulDays - b.rulDays)
  });
});

app.get('/api/fault-diagnosis', (req, res) => {
  const diagnoses = machines.filter(m => (m.faults || []).length > 0 || m.health < 80).map(m => {
    const faults = (m.faults || []).map(f => {
      const ft = FAULT_TYPES[f.type] || { label: f.type, action: 'Inspect', severity: 'medium' };
      return { ...f, ...ft };
    });
    if (faults.length === 0 && m.health < 80) {
      faults.push({ type: 'general_degradation', label: 'General Degradation', probability: (100 - m.health) / 100, confidence: 0.65, action: 'Perform comprehensive inspection', severity: 'medium' });
    }
    return {
      machineId: m.id, machineName: m.name, factoryId: m.factoryId,
      factoryName: factories.find(f => f.id === m.factoryId)?.name || m.factoryId,
      health: m.health, status: m.status, rulDays: m.rulDays, rulHours: m.rulHours,
      anomalyScore: m.anomalyScore, line: m.line,
      faults,
      rootCause: faults[0]?.label || 'No faults detected',
      gnnConfidence: faults[0]?.confidence || 0
    };
  });
  res.json(diagnoses);
});

app.get('/api/anomaly-detection', (req, res) => {
  const anomalies = machines.map(m => {
    const sensorAnomalies = (m.sensors || []).filter(s => s.threshold && s.latest > s.threshold).map(s => ({
      sensor: s.type, value: s.latest, threshold: s.threshold, severity: s.latest > s.threshold * 1.2 ? 'critical' : 'warning'
    }));
    return {
      machineId: m.id, machineName: m.name, factoryId: m.factoryId,
      anomalyScore: m.anomalyScore,
      isAnomaly: m.anomalyScore > 0.4,
      sensorAnomalies,
      timeline: Array.from({ length: 12 }, (_, i) => ({
        hour: i, score: +(Math.max(0, m.anomalyScore + (Math.random() - 0.5) * 0.3)).toFixed(2)
      }))
    };
  }).sort((a, b) => b.anomalyScore - a.anomalyScore);
  res.json(anomalies);
});

app.get('/api/rul-prediction', (req, res) => {
  res.json(machines.map(m => ({
    machineId: m.id, machineName: m.name, factoryId: m.factoryId,
    type: m.type, health: m.health,
    rulHours: m.rulHours, rulDays: m.rulDays,
    confidence: +(0.75 + Math.random() * 0.2).toFixed(2),
    degradationCurve: Array.from({ length: 14 }, (_, i) => ({
      day: i, health: Math.max(30, m.health - i * ((100 - m.health) / 14))
    })),
    failureMode: (m.faults && m.faults[0]) ? FAULT_TYPES[m.faults[0].type]?.label || 'Unknown' : 'Normal wear'
  })).sort((a, b) => a.rulDays - b.rulDays));
});

// ── Analytics ──
app.get('/api/analytics', (req, res) => res.json(getAnalytics()));

// ── Alerts ──
app.get('/api/alerts', (req, res) => {
  const { status, severity } = req.query;
  let result = [...alerts];
  if (status) result = result.filter(a => a.status === status);
  if (severity) result = result.filter(a => a.severity === severity);
  res.json(result);
});

app.patch('/api/alerts/:id', (req, res) => {
  const a = alerts.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Alert not found' });
  Object.assign(a, req.body);
  res.json(a);
});

app.post('/api/alerts/acknowledge-all', (req, res) => {
  alerts.forEach(a => { if (a.status === 'open') a.status = 'acknowledged'; });
  res.json({ acknowledged: alerts.filter(a => a.status === 'acknowledged').length });
});

// ── Reports ──
app.get('/api/reports', (req, res) => res.json(reports));

app.post('/api/reports/generate', (req, res) => {
  const analytics = getAnalytics();
  const report = {
    reportId: 'RPT-' + Date.now(),
    title: req.body.title || 'Maintenance Intelligence Report',
    type: req.body.type || 'comprehensive',
    generatedAt: new Date().toISOString(),
    organization: organization.name,
    period: req.body.period || 'Last 30 days',
    summary: {
      avgHealth: analytics.kpis.avgHealth,
      avgOEE: analytics.kpis.avgOEE,
      openAlerts: analytics.kpis.openAlerts,
      maintenanceCostINR: analytics.kpis.maintenanceCostINR,
      predictedFailures: analytics.kpis.predictedFailures7d
    },
    sections: [
      { title: 'Executive Summary', content: `${analytics.kpis.totalMachines} machines across ${analytics.kpis.totalFactories} plants. Average health ${analytics.kpis.avgHealth}%. ${analytics.kpis.predictedFailures7d} failures predicted in next 7 days.` },
      { title: 'Critical Actions', content: maintenanceTasks.filter(t => t.priority === 'critical' || t.priority === 'high').map(t => t.task).join('; ') },
      { title: 'Cost Analysis (INR)', content: `Total planned maintenance: ₹${analytics.kpis.maintenanceCostINR.toLocaleString('en-IN')}. Estimated downtime cost: ₹${analytics.kpis.estimatedDowntimeCostINR.toLocaleString('en-IN')}.` },
      { title: 'GNN Model Performance', content: 'InduGraph-GNN-v2.1 — 94.2% accuracy, 45ms inference latency on ap-south-1.' }
    ],
    machines: machines.map(m => ({ id: m.id, name: m.name, health: m.health, rulDays: m.rulDays, status: m.status }))
  };
  reports.unshift(report);
  res.status(201).json(report);
});

// ── Sensor data upload ──
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const meta = {
    id: 'DS-' + Date.now(),
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    rows: Math.floor(Math.random() * 5000) + 500
  };
  uploadedDatasets.unshift(meta);
  res.json(meta);
});

app.get('/api/datasets', (req, res) => res.json(uploadedDatasets));

// ── Research APIs ──
app.get('/api/research/overview', (req, res) => {
  const deployed = (research.experiments || []).find(e => e.status === 'deployed');
  res.json({
    project: research.project,
    methodology: research.methodology,
    deployedModel: deployed,
    benchmark: research.benchmarks?.improvementOverLSTM,
    publicationCount: (research.project?.publications || []).length,
    experimentCount: (research.experiments || []).length,
    datasetCount: (research.researchDatasets || []).length
  });
});

app.get('/api/research/experiments', (req, res) => res.json(research.experiments || []));

app.get('/api/research/experiments/:id/curves', (req, res) => {
  const id = req.params.id;
  const stored = research.trainingCurves?.[id];
  if (stored) return res.json(stored);
  const exp = (research.experiments || []).find(x => x.id === id);
  if (!exp) return res.status(404).json({ error: 'Experiment not found' });
  const generated = synthTrainingCurves(exp);
  if (!generated) return res.status(404).json({ error: 'No training curves for this experiment' });
  res.json(generated);
});

function synthTrainingCurves(exp) {
  if (!exp.epochs || exp.epochs <= 0) return synthClassicalCurves(exp);
  const total = exp.epochs;
  const best = exp.bestEpoch || Math.round(total * 0.85);
  const targetF1 = exp.f1 || 0.85;
  const epochSet = new Set();
  const step = Math.max(1, Math.round(total / 18));
  for (let ep = step; ep <= total; ep += step) epochSet.add(ep);
  epochSet.add(best);
  epochSet.add(total);
  const epochs = [...epochSet].sort((a, b) => a - b);
  const valF1 = epochs.map(ep => {
    const t = ep / total;
    const curve = targetF1 * (0.72 + 0.28 * (1 - Math.exp(-3.2 * t)));
    return +Math.min(targetF1, curve).toFixed(3);
  });
  const bestIdx = epochs.indexOf(best);
  if (bestIdx >= 0) valF1[bestIdx] = targetF1;
  const trainLoss = epochs.map(ep => +(0.85 * Math.exp(-2.4 * ep / total) + 0.11 + Math.random() * 0.01).toFixed(3));
  const valLoss = epochs.map((ep, i) => +(trainLoss[i] * 1.12 + 0.04 + (i > bestIdx ? (i - bestIdx) * 0.003 : 0)).toFixed(3));
  return { curveType: 'neural', xLabel: 'Epoch', epochs, trainLoss, valLoss, valF1 };
}

function synthClassicalCurves(exp) {
  const trees = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  const targetF1 = exp.f1 || 0.798;
  const valF1 = trees.map((t, i) => {
    const progress = (i + 1) / trees.length;
    return +(targetF1 * (0.82 + 0.18 * (1 - Math.exp(-2.5 * progress)))).toFixed(3);
  });
  valF1[valF1.length - 1] = targetF1;
  const trainLoss = trees.map((t, i) => +(0.42 * Math.exp(-1.6 * (i + 1) / trees.length) + 0.16).toFixed(3));
  const valLoss = trainLoss.map(e => +(e * 1.06 + 0.025).toFixed(3));
  return {
    curveType: 'classical',
    xLabel: 'Trees',
    epochs: trees,
    trainLoss,
    valLoss,
    valF1,
    trainLabel: 'OOB Error',
    valLabel: 'CV Error'
  };
}

app.post('/api/research/experiments/run', (req, res) => {
  const exp = {
    id: 'EXP-' + Date.now(),
    name: req.body.name || 'Custom Experiment',
    status: 'running',
    date: new Date().toISOString().slice(0, 10),
    epochs: req.body.epochs || 100,
    bestEpoch: 0,
    lr: req.body.lr || 0.001,
    batchSize: req.body.batchSize || 32,
    f1: 0, accuracy: 0, rulMae: 0, rulRmse: 0, auc: 0, latencyMs: 0,
    params: req.body.params || '2.4M',
    notes: 'Queued for training on A100 cluster'
  };
  if (!research.experiments) research.experiments = [];
  research.experiments.unshift(exp);
  setTimeout(() => {
    const e = research.experiments.find(x => x.id === exp.id);
    if (e) {
      e.status = 'completed';
      e.f1 = +(0.85 + Math.random() * 0.08).toFixed(3);
      e.accuracy = +(88 + Math.random() * 8).toFixed(1);
      e.rulMae = +(17 + Math.random() * 8).toFixed(1);
      e.auc = +(0.93 + Math.random() * 0.04).toFixed(3);
      e.bestEpoch = Math.floor(exp.epochs * 0.85);
    }
  }, 3000);
  res.status(201).json(exp);
});

app.get('/api/research/benchmarks', (req, res) => res.json(research.benchmarks || {}));

app.get('/api/research/ablation', (req, res) => res.json(research.ablationStudies || []));

app.get('/api/research/confusion-matrix', (req, res) => res.json(research.confusionMatrix || {}));

app.get('/api/research/datasets', (req, res) => res.json(research.researchDatasets || []));

app.get('/api/research/notebook', (req, res) => res.json(research.labNotebook || []));

app.post('/api/research/notebook', (req, res) => {
  const entry = {
    id: 'NB-' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    author: req.body.author || 'Researcher',
    tag: req.body.tag || 'Note',
    title: req.body.title || 'Untitled',
    content: req.body.content || ''
  };
  if (!research.labNotebook) research.labNotebook = [];
  research.labNotebook.unshift(entry);
  res.status(201).json(entry);
});

app.get('/api/research/explainability', (req, res) => {
  const machineId = req.query.machineId;
  const m = machines.find(x => x.id === machineId);
  const globalImp = research.explainability?.globalFeatureImportance || [];
  const fleetNode = research.explainability?.fleetNodeAttention || [];
  const fleetSal = research.explainability?.fleetSaliencyMap || [];

  let nodeAttn;
  let saliencyMap;

  if (m) {
    nodeAttn = (m.sensors || []).map(s => ({
      node: s.type,
      attention: +(0.15 + Math.random() * 0.35).toFixed(3),
      sensorId: s.id
    })).sort((a, b) => b.attention - a.attention);
    nodeAttn.unshift({ node: m.name, attention: +(0.25 + Math.random() * 0.2).toFixed(3), sensorId: m.id });
    saliencyMap = (m.sensors || []).map(s => ({
      sensor: s.type,
      saliency: +(Math.min(1, (s.latest / (s.threshold || 1)) * 0.5 + Math.random() * 0.3)).toFixed(3)
    }));
  } else {
    nodeAttn = fleetNode;
    saliencyMap = fleetSal;
  }

  res.json({
    machineId: machineId || null,
    machineName: m?.name || 'Fleet-wide',
    globalFeatureImportance: globalImp,
    nodeAttention: nodeAttn,
    gnnLayerWeights: [
      { layer: 'HeteroGAT-1', avgAttention: 0.31, heads: 4 },
      { layer: 'HeteroGAT-2', avgAttention: 0.28, heads: 4 },
      { layer: 'HeteroGAT-3', avgAttention: 0.24, heads: 4 },
      { layer: 'GRU Temporal', avgAttention: 0.17, heads: 1 }
    ],
    saliencyMap
  });
});

app.get('/api/research/roc-curve', (req, res) => {
  const points = Array.from({ length: 20 }, (_, i) => {
    const fpr = i / 19;
    return { fpr: +fpr.toFixed(3), tpr: +(Math.min(1, Math.pow(fpr, 0.3) * 1.05 + 0.02)).toFixed(3) };
  });
  res.json({ induGraph: points, lstm: points.map(p => ({ fpr: p.fpr, tpr: +(p.tpr * 0.92).toFixed(3) })), auc: { induGraph: 0.967, lstm: 0.912 } });
});

app.get('/api/research/lab-dashboard', (req, res) => {
  const compute = { ...(research.labCompute || {}) };
  if (compute.gpus) {
    compute.gpus = compute.gpus.map(g => ({
      ...g,
      utilization: Math.min(100, Math.max(0, g.utilization + Math.round((Math.random() - 0.5) * 8))),
      memoryUsed: +(Math.min(g.memoryTotal, Math.max(0, g.memoryUsed + (Math.random() - 0.5) * 2))).toFixed(1)
    }));
  }
  const sensorCount = machines.reduce((n, m) => n + (m.sensors || []).length, 0);
  const graphStats = {
    factories: factories.length,
    machines: machines.length,
    sensors: sensorCount,
    nodes: factories.length + machines.length + sensorCount,
    edges: machines.length * 3 + sensorCount + Math.round(machines.length * 1.4),
    avgDegree: +((machines.length * 3 + sensorCount) / Math.max(1, factories.length + machines.length + sensorCount) * 2.1).toFixed(2),
    rebuildIntervalSec: 30
  };
  const activity = [
    ...(research.labNotebook || []).slice(0, 4).map(n => ({
      id: n.id, type: 'notebook', tag: n.tag, title: n.title, date: n.date, author: n.author,
      summary: (n.content || '').replace(/\n/g, ' ').slice(0, 140) + ((n.content || '').length > 140 ? '…' : ''),
      detail: n.content ? n.content.split('\n').filter(Boolean)[0] : ''
    })),
    ...(research.experiments || []).slice(0, 3).map(x => ({
      id: x.id, type: 'experiment', tag: x.status, title: x.name, date: x.date, author: 'CIAIR Lab',
      summary: x.description || x.hypothesis || '',
      metrics: x.metrics ? ('F1 ' + x.metrics.f1 + ' · Acc ' + x.metrics.accuracy + ' · RUL MAE ' + x.metrics.rulMae + 'h') : '',
      detail: x.model ? ('Model: ' + x.model + ' · Dataset: ' + (x.dataset || '—')) : ''
    }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);

  res.json({
    compute,
    pipeline: research.researchPipeline || [],
    hyperparamSearch: research.hyperparamSearch || {},
    crossValidation: research.crossValidation || {},
    modelRegistry: research.modelRegistry || [],
    graphStats,
    graphAnalytics: buildGraphAnalytics(graphStats),
    activity,
    featureDrift: research.featureDrift || [],
    hyperparamSearchSpace: research.hyperparamSearchSpace || {}
  });
});

function buildGraphAnalytics(stats) {
  const base = research.graphAnalytics || {};
  return {
    ...base,
    nodeTypes: (base.nodeTypes || []).map(n => ({
      ...n,
      count: n.type === 'Factory' ? stats.factories : n.type === 'Machine' ? stats.machines : stats.sensors
    })),
    liveStats: stats
  };
}

app.post('/api/research/compute/submit-job', (req, res) => {
  if (!research.labCompute) research.labCompute = { queue: [], gpus: [] };
  if (!research.labCompute.queue) research.labCompute.queue = [];
  const job = {
    id: 'JOB-' + (1045 + research.labCompute.queue.length),
    name: req.body.name || 'Custom training job',
    status: 'queued',
    eta: Math.floor(1 + Math.random() * 5) + 'h ' + Math.floor(Math.random() * 59) + 'm',
    priority: req.body.priority || 'medium'
  };
  research.labCompute.queue.unshift(job);
  res.status(201).json(job);
});

app.post('/api/research/model-registry/promote', (req, res) => {
  const version = req.body.version;
  const registry = research.modelRegistry || [];
  registry.forEach(m => {
    if (m.status === 'production') m.status = 'archived';
  });
  const target = registry.find(m => m.version === version);
  if (!target) return res.status(404).json({ error: 'Model version not found' });
  target.status = 'production';
  target.deployedAt = new Date().toISOString().slice(0, 10);
  if (!target.plants?.length) target.plants = ['Pune', 'Chennai', 'Ahmedabad'];
  res.json({ promoted: target, registry });
});

app.post('/api/research/hyperparam-search/run', (req, res) => {
  const trial = {
    trial: (research.hyperparamSearch?.trials || 48) + 1,
    f1: +(0.88 + Math.random() * 0.04).toFixed(3),
    rulMae: +(17 + Math.random() * 4).toFixed(1),
    lr: +(0.0003 + Math.random() * 0.001).toFixed(4),
    score: +(0.86 + Math.random() * 0.05).toFixed(3)
  };
  if (!research.hyperparamSearch) research.hyperparamSearch = { framework: 'Optuna', trials: 0, topTrials: [] };
  research.hyperparamSearch.trials += 1;
  research.hyperparamSearch.topTrials = [trial, ...(research.hyperparamSearch.topTrials || [])]
    .sort((a, b) => b.score - a.score).slice(0, 5);
  if (trial.score >= (research.hyperparamSearch.bestTrial?.score || 0)) {
    research.hyperparamSearch.bestTrial = { id: trial.trial, f1: trial.f1, rulMae: trial.rulMae, lr: trial.lr, heads: 4, hiddenDim: 128, dropout: 0.15, score: trial.score };
  }
  res.status(201).json(trial);
});

// ── SPA fallback ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`InduGraph AI server running on port ${PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`);
    console.error('Stop the existing server first:  npm run stop');
    console.error('Or use another port:           $env:PORT=3001; npm start\n');
    process.exit(1);
  }
  throw err;
});
