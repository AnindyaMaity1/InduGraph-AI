(function () {
  const IG = window.InduGraph;
  const Pages = window.InduGraphPages;
  const Research = window.InduGraphResearch;
  const rootEl = document.getElementById('root');

  function showBootError(message) {
    rootEl.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#b91c1c"><h2>InduGraph AI failed to start</h2><pre style="white-space:pre-wrap">' + message + '</pre></div>';
  }

  if (!IG || !Pages || !Research) {
    showBootError('Missing app modules. Ensure /js/core.js, /js/pages.js and /js/research.js loaded correctly.');
    return;
  }

  const e = IG.e;
  const { useState, useEffect, useData, useSettings, Sidebar, ResearchSidebar, routeHash, RESEARCH_ROUTES } = IG;

  function App() {
    const [data, reloadData] = useData();
    const [settings, updateSettings] = useSettings();
    const [route, setRoute] = useState('Overview');
    const [researchMode, setResearchMode] = useState(false);
    const [researchRoute, setResearchRoute] = useState('ResearchLab');
    const [lastMainRoute, setLastMainRoute] = useState('Overview');
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [selectedFactory, setSelectedFactory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    function navigate(to) {
      setSelectedMachine(null);
      location.hash = routeHash(to);
    }

    function navigateResearch(to) {
      location.hash = 'research/' + routeHash(to);
    }

    function openResearchLab() {
      if (!researchMode) setLastMainRoute(route || 'Overview');
      location.hash = 'research/ResearchLab';
    }

    function exitResearch() {
      location.hash = lastMainRoute || 'Overview';
    }

    function onSelectMachine(id) {
      setSelectedMachine(id);
      setSearchQuery('');
    }

    function onNavigateFactory(id) {
      setSelectedFactory(id);
      setSelectedMachine(null);
      navigate('Factory');
      setSearchQuery('');
    }

    const shell = {
      settings,
      onUpdateSettings: updateSettings,
      data,
      searchQuery,
      onSearchChange: setSearchQuery,
      onSelectMachine,
      onNavigateFactory,
      onOpenResearchLab: openResearchLab
    };

    const researchShell = {
      settings,
      onUpdateSettings: updateSettings,
      data,
      onExitResearch: exitResearch
    };

    useEffect(() => {
      const onHash = () => {
        const hash = decodeURIComponent(location.hash || '#Overview').replace('#', '');
        if (hash.startsWith('research/')) {
          const r = hash.slice('research/'.length) || 'ResearchLab';
          setResearchMode(true);
          setResearchRoute(RESEARCH_ROUTES.has(r) ? r : 'ResearchLab');
          return;
        }
        setResearchMode(false);
        setRoute(hash || 'Overview');
        setLastMainRoute(hash || 'Overview');
        if (hash !== 'Machines' && !hash.startsWith('Machine')) setSelectedMachine(null);
      };
      window.addEventListener('hashchange', onHash);
      onHash();
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    useEffect(() => {
      const interval = setInterval(reloadData, (settings.refreshInterval || 30) * 1000);
      return () => clearInterval(interval);
    }, [settings.refreshInterval, reloadData]);

    const shared = { shell, data, settings, onUpdateSettings: updateSettings, onSelectMachine, selectedFactory, searchQuery };

    if (researchMode) {
      const researchMain = (() => {
        switch (researchRoute) {
          case 'ResearchLab': return e(Research.ResearchLabPage, { ...shared, shell: researchShell });
          case 'ComputeCluster': return e(Research.ComputeClusterPage, { ...shared, shell: researchShell });
          case 'HyperparameterSearch': return e(Research.HyperparamSearchPage, { ...shared, shell: researchShell });
          case 'CrossValidation': return e(Research.CrossValidationPage, { ...shared, shell: researchShell });
          case 'ModelRegistry': return e(Research.ModelRegistryPage, { ...shared, shell: researchShell });
          case 'FeatureDrift': return e(Research.FeatureDriftPage, { ...shared, shell: researchShell });
          case 'GraphAnalytics': return e(Research.GraphAnalyticsPage, { ...shared, shell: researchShell });
          case 'ResearchPipeline': return e(Research.ResearchPipelinePage, { ...shared, shell: researchShell });
          case 'Experiments': return e(Research.ExperimentsPage, { ...shared, shell: researchShell });
          case 'Benchmarks': return e(Research.BenchmarksPage, { ...shared, shell: researchShell });
          case 'Explainability': return e(Research.ExplainabilityPage, { ...shared, shell: researchShell });
          case 'AblationStudies': return e(Research.AblationPage, { ...shared, shell: researchShell });
          case 'ResearchDatasets': return e(Research.ResearchDatasetsPage, { ...shared, shell: researchShell });
          case 'LabNotebook': return e(Research.LabNotebookPage, { ...shared, shell: researchShell });
          default: return e(Research.ResearchLabPage, { ...shared, shell: researchShell });
        }
      })();

      return e('div', { className: 'app research-app' },
        e(ResearchSidebar, { onNav: navigateResearch, current: researchRoute }),
        e('div', { className: 'content' }, researchMain)
      );
    }

    const main = (() => {
      if (selectedMachine) {
        return e(Pages.MachineDetail, { id: selectedMachine, onBack: () => setSelectedMachine(null), ...shared });
      }
      switch (route) {
        case 'Overview': return e(Pages.Overview, shared);
        case 'Factory': return e(Pages.FactoryPage, shared);
        case 'Machines': return e(Pages.MachinesPage, shared);
        case 'LiveMonitoring': return e(Pages.LiveMonitoring, shared);
        case 'SensorData': return e(Pages.SensorDataPage, shared);
        case 'GNNGraph': return e(Pages.GNNGraphPage, shared);
        case 'PredictiveMaintenance': return e(Pages.PredictiveMaintenance, shared);
        case 'FaultDiagnosis': return e(Pages.FaultDiagnosis, shared);
        case 'AnomalyDetection': return e(Pages.AnomalyDetection, shared);
        case 'RULPrediction': return e(Pages.RULPrediction, shared);
        case 'Analytics': return e(Pages.AnalyticsPage, shared);
        case 'Alerts': return e(Pages.AlertsPage, shared);
        case 'Reports': return e(Pages.ReportsPage, shared);
        default: return e(Pages.Overview, shared);
      }
    })();

    return e('div', { className: 'app' },
      e(Sidebar, { onNav: navigate, current: route }),
      e('div', { className: 'content' }, main)
    );
  }

  try {
    if (typeof ReactDOM.render === 'function') {
      ReactDOM.render(e(App), rootEl);
    } else if (typeof ReactDOM.createRoot === 'function') {
      ReactDOM.createRoot(rootEl).render(e(App));
    } else {
      showBootError('ReactDOM is not available. Check React script tags.');
    }
  } catch (err) {
    showBootError(err.message || String(err));
    console.error(err);
  }
})();
