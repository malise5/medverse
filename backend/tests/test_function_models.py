"""Scientific checks for the cardiac-cycle, breathing and action-potential models.

As with the Windkessel tests, these verify the implementation against properties that
follow from the model equations; they do not validate the models against people.
"""

import math

import numpy as np
import pytest

from app.simulation.core import SimulationInputError
from app.simulation.models import hodgkin_huxley as hh
from app.simulation.models.cardiac_cycle import CardiacCycle, normalised_elastance
from app.simulation.models.respiratory import SingleCompartmentLung
from app.simulation.registry import list_models, models_for_structure

CARDIAC, LUNG, NEURON = CardiacCycle(), SingleCompartmentLung(), hh.HodgkinHuxley()


@pytest.mark.parametrize("model", list_models(), ids=lambda m: m.definition.id)
def test_definitions_are_complete(model):
    d = model.definition
    for spec in [*d.parameters, *d.metrics]:
        assert spec.unit or spec.id in {"spike_count"}, spec.id
    for p in d.parameters:
        assert p.min <= p.default <= p.max, p.id
    series = {s.id for s in d.series}
    for b in d.animations:
        assert b.output in series
        assert set(b.structure_ids) <= set(d.linked_structure_ids)
        assert b.description and 0 < b.amplitude <= 1
    assert d.playback_rate > 0
    units = {s.id: s.unit for s in d.series}
    params = {p.id: p for p in d.parameters}
    for plot in d.phase_plots:
        assert {plot.x, plot.y} <= series and plot.x != plot.y, plot.id
        assert plot.description
        for line in plot.lines:
            # slope converts x into y, so its unit must be y-unit per x-unit
            assert params[line.slope_parameter].unit == f"{units[plot.y]}/{units[plot.x]}"
            assert params[line.x_intercept_parameter].unit == units[plot.x]
    assert len({p.id for p in d.phase_plots}) == len(d.phase_plots)
    result = model.run()
    assert all(len(v) == len(result.time) for v in result.series.values())
    assert all(math.isfinite(v) for v in result.metrics.values())


def test_structures_link_to_models_through_ancestors():
    ids = [m.definition.id for m in models_for_structure("FMA:7101")]
    assert ids[0] == "cv.cardiac_cycle"  # primary function model for the left ventricle
    assert [m.definition.id for m in models_for_structure("FMA:0", ["FMA:7309"])] == [
        "resp.single_compartment"
    ]
    assert models_for_structure("FMA:0") == []


# --- cardiac cycle ---------------------------------------------------------------


def test_normalised_elastance_peaks_near_one():
    xs = np.linspace(0, 3, 3001)
    en = np.array([normalised_elastance(x) for x in xs])
    assert en.max() == pytest.approx(1.0, abs=0.01)
    assert xs[en.argmax()] == pytest.approx(1.0, abs=0.02)


def _cardiac(**overrides):
    params = CARDIAC.resolve_parameters(overrides)
    return params, CARDIAC.simulate(params)


@pytest.mark.parametrize("overrides", [{}, {"heart_rate": 100, "t_max": 0.25}, {"e_max": 1.5}])
def test_cardiac_conservation_and_valves(overrides):
    params, r = _cardiac(**overrides)
    period = 60 / params["heart_rate"]
    t = np.array(r.time)
    last = t >= t[-1] - period + 1e-9
    q_mv, q_av = np.array(r.series["mitral_flow"]), np.array(r.series["aortic_flow"])
    assert q_mv.min() >= 0 and q_av.min() >= 0  # ideal valves never leak
    dt = t[1] - t[0]
    inflow = np.trapezoid(q_mv[last], dx=dt)
    outflow = np.trapezoid(q_av[last], dx=dt)
    sv = r.metrics["stroke_volume"]
    # Display series are downsampled (5 ms), so allow sampling error in the integrals.
    assert inflow == pytest.approx(sv, rel=0.03)
    assert outflow == pytest.approx(sv, rel=0.03)
    assert r.metrics["steady_state_residual"] < 0.5


def test_cardiac_mean_pressure_matches_outflow():
    params, r = _cardiac()
    period = 60 / params["heart_rate"]
    mean_q = r.metrics["stroke_volume"] / period
    expected = (params["peripheral_resistance"] + params["characteristic_impedance"]) * mean_q
    assert r.metrics["mean_arterial_pressure"] == pytest.approx(expected, rel=0.005)


def test_cardiac_has_isovolumic_phases():
    _, r = _cardiac()
    q_mv, q_av = np.array(r.series["mitral_flow"]), np.array(r.series["aortic_flow"])
    both_closed = (q_mv == 0) & (q_av == 0)
    assert both_closed.any()
    assert not ((q_mv > 0) & (q_av > 0)).any()  # never open together


def test_cardiac_qualitative_responses():
    base = _cardiac()[1].metrics
    preload = _cardiac(la_pressure=14)[1].metrics
    contract = _cardiac(e_max=5.0)[1].metrics
    afterload = _cardiac(peripheral_resistance=1.8)[1].metrics
    assert preload["stroke_volume"] > base["stroke_volume"]  # Frank–Starling
    assert contract["ejection_fraction"] > base["ejection_fraction"]
    assert afterload["mean_arterial_pressure"] > base["mean_arterial_pressure"]
    assert afterload["stroke_volume"] < base["stroke_volume"]


def test_cardiac_defaults_are_physiologically_plausible():
    m = _cardiac()[1].metrics
    assert 100 < m["end_diastolic_volume"] < 160
    assert 50 < m["ejection_fraction"] < 70
    assert 100 < m["systolic_pressure"] < 140 and 60 < m["diastolic_pressure"] < 90


def test_cardiac_step_convergence():
    params = CARDIAC.resolve_parameters({})
    a = CARDIAC.simulate(params, dt=0.0005).metrics
    b = CARDIAC.simulate(params, dt=0.000125).metrics
    for k in ("systolic_pressure", "diastolic_pressure", "peak_lv_pressure"):
        assert abs(a[k] - b[k]) < 0.2, k


@pytest.mark.parametrize("overrides", [{}, {"e_max": 5.0}, {"la_pressure": 16, "e_min": 0.12}])
def test_pv_loop_lies_between_edpvr_and_espvr(overrides):
    """E_min ≤ E(t) ≤ E_max·max(Eₙ) and P = E(t)·(V − V₀), so every loop point lies between
    the two lines, and the end-systolic corner touches the ESPVR (peak elastance)."""
    params, r = _cardiac(**overrides)
    v = np.asarray(r.series["lv_volume"]) - params["v0"]
    p = np.asarray(r.series["lv_pressure"])
    assert (v > 0).all()
    tol = 0.002 * p.max() + 0.002  # display series are rounded to 3 decimals
    assert (p >= params["e_min"] * v - tol).all()
    assert (p <= params["e_max"] * v * 1.01 + tol).all()
    assert (p / (params["e_max"] * v)).max() == pytest.approx(1.0, abs=0.03)
    # Anticlockwise in (V, P) gives a positive shoelace area: the stroke work per beat.
    # It must lie between SV·(diastolic aortic pressure) and SV·(peak LV pressure).
    beats_shown = round(r.time[-1] * params["heart_rate"] / 60)
    work = 0.5 * np.sum(v * np.roll(p, -1) - np.roll(v, -1) * p) / beats_shown
    m = r.metrics
    assert m["stroke_volume"] * m["diastolic_pressure"] < work
    assert work < m["stroke_volume"] * m["peak_lv_pressure"]


def test_cardiac_rejects_impossible_timing():
    with pytest.raises(SimulationInputError):
        CARDIAC.run({"heart_rate": 180, "t_max": 0.45})


# --- breathing -------------------------------------------------------------------


def _lung(**overrides):
    params = LUNG.resolve_parameters(overrides)
    return params, LUNG.simulate(params)


def test_lung_expiration_decays_with_rc():
    params, r = _lung(resistance=4.0, compliance=0.08)
    period = 60 / params["resp_rate"]
    t_i = params["insp_fraction"] * period
    t = np.array(r.time)
    v = np.array(r.series["lung_volume"]) - params["frc"]
    # Final breath's expiration, avoiding the first 0.1 s after the muscles stop.
    start = t[-1] - period + t_i + 0.1
    sel = (t > start) & (t < start + 1.0) & (v > 1e-3)
    slope = np.polyfit(t[sel], np.log(v[sel]), 1)[0]
    assert -1 / slope == pytest.approx(4.0 * 0.08, rel=0.01)


def test_lung_volume_approaches_c_pmax_when_fast():
    params, r = _lung(resistance=0.5, compliance=0.05, muscle_pressure=10)
    assert r.metrics["tidal_volume"] == pytest.approx(1000 * 0.05 * 10, rel=0.03)


def test_lung_is_linear_in_muscle_pressure():
    a = _lung(muscle_pressure=4)[1].metrics["tidal_volume"]
    b = _lung(muscle_pressure=8)[1].metrics["tidal_volume"]
    assert b == pytest.approx(2 * a, rel=0.01)


def test_lung_minute_ventilation_and_net_flow():
    params, r = _lung()
    m = r.metrics
    assert m["minute_ventilation"] == pytest.approx(
        m["tidal_volume"] / 1000 * params["resp_rate"], rel=0.01
    )
    period = 60 / params["resp_rate"]
    t = np.array(r.time)
    last = t >= t[-1] - period + 1e-9
    net = np.trapezoid(np.array(r.series["airflow"])[last], dx=t[1] - t[0])
    assert abs(net) < 0.01  # L
    assert 400 < m["tidal_volume"] < 600 and m["trapped_volume"] < 1


def test_lung_high_resistance_traps_gas():
    _, r = _lung(resistance=30, resp_rate=20)
    assert r.metrics["trapped_volume"] > 20
    assert any("trapped" in w for w in r.warnings)


def test_lung_step_convergence():
    params = LUNG.resolve_parameters({})
    a = LUNG.simulate(params, dt=0.001).metrics["tidal_volume"]
    b = LUNG.simulate(params, dt=0.00025).metrics["tidal_volume"]
    assert abs(a - b) < 0.1


# --- action potential ------------------------------------------------------------


def _neuron(**overrides):
    return NEURON.run(overrides)


def test_neuron_rests_at_minus_65_without_stimulus():
    v = np.array(_neuron(stim_amplitude=0).series["membrane_potential"])
    assert np.abs(v + 65).max() < 0.1


def test_neuron_threshold_is_all_or_none():
    weak = _neuron(stim_amplitude=2, stim_interval=100, duration=40).metrics
    strong = _neuron(stim_amplitude=20, stim_interval=100, duration=40).metrics
    assert weak["spike_count"] == 0 and weak["first_spike_latency"] == -1
    assert strong["spike_count"] == 1
    assert 30 < strong["peak_potential"] < 50 < hh.E_NA + 1


def test_neuron_is_refractory():
    # A second identical pulse 3 ms later fails; 30 ms later it fires again.
    soon = _neuron(stim_amplitude=20, stim_width=0.5, stim_interval=3, duration=16)
    late = _neuron(stim_amplitude=20, stim_width=0.5, stim_interval=30, duration=50)
    assert soon.metrics["spike_count"] == 1
    assert late.metrics["spike_count"] == 2


def test_neuron_gates_bounded_and_converged():
    r = _neuron()
    for g in ("m_gate", "h_gate", "n_gate"):
        x = np.array(r.series[g])
        assert x.min() >= 0 and x.max() <= 1
    params = NEURON.resolve_parameters({"duration": 20})
    a = NEURON.simulate(params, dt=0.01).metrics["peak_potential"]
    b = NEURON.simulate(params, dt=0.0025).metrics["peak_potential"]
    assert abs(a - b) < 0.5


def test_sodium_block_abolishes_spikes():
    assert _neuron(g_na=0).metrics["spike_count"] == 0
