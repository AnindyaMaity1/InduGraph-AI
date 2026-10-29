# InduGraph AI

It is Built under the guidance of **Prof. Dr. Aritra Bandyopadhyay**

InduGraph AI is a research and operations platform for explainable industrial predictive maintenance. It combines factory, machine, and sensor relationships in a heterogeneous graph so maintenance teams can monitor equipment health, investigate faults, estimate remaining useful life, and understand why a prediction was made.

The repository contains a self-contained demonstration application. It uses sample manufacturing data and simulated telemetry so the complete dashboard can be explored without a database, external model service, or industrial sensor connection.

## InduGraph Overview

### Dashboard

The operations dashboard gives maintenance teams a fleet-wide view of machine health, plant OEE, active alerts, predicted failures, maintenance cost, and asset-level performance.

![InduGraph AI Dashboard](<DashBoard Image.png>)

### Research Lab

The Research Lab provides tools for experiment tracking, model evaluation, graph analytics, explainability, feature drift monitoring, and research workflow management.

![InduGraph AI Research Lab](<Research Lab Image.png>)

## What the platform does

- Presents fleet health, factory performance, OEE, uptime, costs, and open alerts.
- Displays machine sensor readings and a live monitoring view.
- Builds an interactive graph of factories, machines, sensors, and machine correlations.
- Provides predictive maintenance recommendations and remaining useful life (RUL) estimates.
- Shows fault diagnosis, anomaly detection, sensor threshold breaches, and recommended actions.
- Explains predictions through sensor contributors, node attention, saliency, and GNN layer weights.
- Supports sensor-data file uploads and lists uploaded datasets for the current session.
- Generates maintenance intelligence reports in the dashboard.
- Includes a Research Lab for experiments, benchmarks, ablation studies, feature drift, model registry, compute jobs, graph analytics, and a lab notebook.

## How it works

1. On startup, the server loads `public/data/data.json` and enriches the machine records with runtime fields.
2. The frontend is a React application loaded from a plain JavaScript file.
3. Live monitoring uses Server-Sent Events. Every three seconds, the server slightly updates sensor readings and machine health, then streams the snapshot to the browser.
4. GNN analysis is represented by the API response from the data: graph structure, attention paths, sensor contributors, severity, failure mode, and recommended action.
5. Research content is loaded from `public/data/research.json`. Experiment runs, reports, alerts, notebook entries, and uploads are held in server memory for the duration of the process.

## Important limitations

- This is a demonstration and research interface.
- Telemetry, confidence values, training curves, and some research metrics are simulated.
- Uploaded files are stored in `uploads/`.
- Authentication, authorization, tenant isolation, input validation, durable storage, and production observability still need to be added before deployment.

## License

MIT license has been specified for this project.
