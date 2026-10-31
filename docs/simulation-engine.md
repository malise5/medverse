# Simulation engine

`backend/app/simulation/`. Pure Python/NumPy; no HTTP, DB or rendering dependencies.

## Abstractions

| Type | Purpose |
|---|---|
| `ParameterSpec` | id, label, **unit**, default, min, max, step, description |
| `OutputSpec` | id, label, **unit**, description (time series and scalar metrics) |
| `ModelDefinition` | purpose, equations, solver, initial conditions, assumptions, limitations, validation, evidence class, references, linked structure IDs, visual mappings, disclaimer |
| `SimulationModel` | `resolve_parameters` (unknown/out-of-range/non-finite → `SimulationInputError`), `cross_validate`, `simulate` |
| `registry` | model lookup; `models_for_structure(structure_id)` links anatomy → simulations |
| `solvers` | `rk4`, `rk4_scalar` (fixed-step classical Runge–Kutta) |

Pathology scenarios (`condition_scenarios`) are **parameter overrides** applied on top of a
model's defaults; explicit user parameters still win. A disease is therefore never a
separate animation; it is the same model in a different parameter regime, with its own
documented assumptions.

API: `GET /simulations/models`, `GET /simulations/models/{id}`,
`POST /simulations/models/{id}/run {parameters, scenario_id}` (persists a `simulation_runs`
row), `WS /simulations/ws` (interactive runs; cookie auth; Origin checked).

## Model card: `cv.windkessel3` v1.0.0: three-element Windkessel

**Evidence class C: simplified educational model.** Not validated against patient data.

Equations (Westerhof, Lankhaar & Westerhof 2009):

```
Q(t) = Q0·sin(π·τ/Te) for τ < Te, else 0;  τ = t mod (60/HR);  Q0 = π·SV/(2·Te)
C · dPc/dt = Q(t) − (Pc − Pout)/R
P_aorta = Pc + Zc·Q
```

| Parameter | Unit | Default | Range |
|---|---|---|---|
| Heart rate | beats/min | 75 | 30–200 |
| Stroke volume | mL | 70 | 10–150 |
| Ejection duration | s | 0.30 | 0.10–0.50 (< 80 % of cycle) |
| Total peripheral resistance R | mmHg·s/mL | 1.0 | 0.3–3.0 |
| Total arterial compliance C | mL/mmHg | 1.1 | 0.3–4.0 |
| Characteristic impedance Zc | mmHg·s/mL | 0.05 | 0–0.3 |
| Outflow pressure | mmHg | 0 | 0–20 |
| Initial pressure | mmHg | 80 | 0–200 |
| Beats simulated | beats | 12 | 3–40 |

Defaults are **illustrative**, chosen to give ≈ 119/68 mmHg (MAP 92) at rest; they are not
fitted to any dataset.

Solver: RK4, dt = 1 ms; metrics over the final beat; last three beats returned at 5 ms.

### Validation (automated, `tests/test_simulation_science.py`)

| Check | Criterion |
|---|---|
| Periodic steady-state mean pressure = Pout + (R+Zc)·SV·HR/60 | rel. error < 0.5 % across 5 parameter sets |
| Diastolic decay time constant = R·C | fitted τ within 1 % |
| Conservation: ∫Q per beat = SV | rel. error < 0.1 % |
| Step refinement (1 ms vs 0.25 ms) | Δ < 0.1 mmHg |
| Reduced C → wider pulse pressure, unchanged mean | qualitative, per Westerhof 2009 |
| Raised R → MAP scales with (R+Zc) | rel. error < 0.5 % |
| Steady-state detection | warning emitted when residual > 0.5 mmHg |
| Bounds, unknown parameters, ejection > cycle | rejected with structured errors |
| Finite outputs at parameter extremes | all metrics finite |

### Assumptions and limitations

Prescribed half-sine ejection (no ventricle, so no ventricular–arterial coupling); lumped
arterial tree (no wave propagation or reflection, so central and peripheral pressure are
identical); linear constant R and C; no baroreflex. Not CFD. See the model definition for
the full lists shown in the UI.

## Function playback in the 3D workspace

Selecting a structure from search, the hierarchy or a link **shows** it (camera focus +
spotlight: everything else fades to context) and, if a model is linked to the structure
or to anything it is `part_of`, **plays its function** on the 3D model. The registry order
decides the primary model (`models_for_structure(id, ancestor_ids)`).

The model runs once on the server; the browser only replays its output. Each model
declares `animations` (`AnimationBinding`: output, structure IDs, effect `scale` / `tint` /
`glow`, amplitude, normalisation `range` / `magnitude`, and a plain-language description
shown in the UI), plus `time_unit` and `playback_rate`. Effects are presentation only and
never feed back into the model. Scaling a static mesh is a schematic cue, not a
reconstruction of real tissue motion; every binding says so in its description.

| Model | Linked structures | 3D effect |
|---|---|---|
| `cv.cardiac_cycle` | heart, LV, RV, LA, aorta (+ parts) | heart scales with LV volume (±5 %); LV tints with LV pressure; aorta tints with aortic pressure |
| `resp.single_compartment` | right/left lung, trachea, diaphragm | each lung scales with lung volume (±5 %); trachea glows with airflow magnitude |
| `neuro.hodgkin_huxley` | brain, spinal cord | glow marks spike timing (explicitly not brain activity); slowed ≈ 67× |
| `cv.windkessel3` | aorta, heart, LV, … | aorta tints with aortic pressure |

## Model card: `cv.cardiac_cycle` v1.0.0 (class C)

Time-varying elastance left ventricle (Suga, Sagawa & Shoukas 1973) with the double-Hill
normalised elastance and WK3 coupling of Stergiopulos, Meister & Westerhof (1996); ideal
diode valves; constant left-atrial pressure. Defaults (illustrative): EDV ≈ 119 mL,
ESV ≈ 49 mL, EF ≈ 58 %, ≈ 125/72 mmHg. Tests: valve flows non-negative and never
simultaneous, mitral = aortic volume per beat = SV, MAP = (R + Z꜀)·mean flow,
isovolumic phases exist, Frank–Starling / contractility / afterload directions, step
convergence. No right heart, atrial kick or baroreflex.

## Model card: `resp.single_compartment` v1.0.0 (class C)

R·dV/dt + V/C = P_mus(t) (Bates 2009); half-sine inspiratory muscle pressure, passive
expiration. Defaults give tidal volume ≈ 0.48 L at 12/min. Tests: expiratory decay
constant = R·C, V_peak → C·P_max when R·C ≪ Tᵢ, linearity, zero net flow per breath,
gas trapping with high resistance, step convergence. No airway collapse, no regional
ventilation, no gas exchange or control of breathing.

## Model card: `neuro.hodgkin_huxley` v1.0.0 (class C)

Hodgkin & Huxley (1952) squid-axon kinetics in the modern −65 mV convention; single
isopotential patch with a rectangular pulse train. Tests: rest stable at −65 mV,
all-or-none threshold, peak +30 to +50 mV, refractoriness, gates within [0, 1], sodium
block abolishes spikes, step convergence. No propagation, myelin or synapses.

## Planned models (Phase 4)

Each must ship a model card, unit-tagged specs, analytic/benchmark tests and references
before it is exposed.

| Domain | Candidate approach |
|---|---|
| Cardiac cycle | time-varying elastance ventricle + WK3 (adds coupling, PV loops) |
| Conduction / action potential | Hodgkin–Huxley (neuron), FitzHugh–Nagumo (teaching), cable equation for propagation |
| Respiratory mechanics | single-compartment R–C lung, ventilator waveforms; alveolar gas equation |
| Gas exchange | alveolar gas equation, O₂–Hb dissociation (Severinghaus) |
| Renal | GFR from Starling forces; clearance |
| Endocrine | minimal model of glucose–insulin (Bergman) |
| Membrane potential | Goldman–Hodgkin–Katz |

Heavier models move to Celery workers with WebSocket progress.
