"""Scientific validation of the Windkessel model against analytical results.

These tests check the implementation against properties that follow directly from
the model equations; they do not (and cannot) validate the model against patients.
"""

import math

import numpy as np
import pytest

from app.simulation.core import SimulationInputError
from app.simulation.models.windkessel import Windkessel3, ejection_flow

MODEL = Windkessel3()


def run(**overrides):
    return MODEL.run(overrides)


def test_every_parameter_and_output_declares_units():
    d = MODEL.definition
    for spec in [*d.parameters, *d.series, *d.metrics]:
        assert spec.unit, f"{spec.id} has no unit"
    for p in d.parameters:
        assert p.min <= p.default <= p.max


@pytest.mark.parametrize(
    "overrides",
    [
        {},
        {"heart_rate": 110, "ejection_time": 0.25},
        {"peripheral_resistance": 1.6},
        {"outflow_pressure": 10},
        {"characteristic_impedance": 0.0},
    ],
)
def test_mean_pressure_matches_analytical_steady_state(overrides):
    params = MODEL.resolve_parameters(overrides)
    r = MODEL.simulate(params)
    mean_flow = params["stroke_volume"] * params["heart_rate"] / 60.0
    expected = (
        params["outflow_pressure"]
        + (params["peripheral_resistance"] + params["characteristic_impedance"]) * mean_flow
    )
    assert r.metrics["mean_arterial_pressure"] == pytest.approx(expected, rel=5e-3)


def test_ejected_volume_equals_stroke_volume():
    for sv in (40, 70, 120):
        assert run(stroke_volume=sv).metrics["ejected_volume"] == pytest.approx(sv, rel=1e-3)


def test_diastolic_decay_has_time_constant_rc():
    params = MODEL.resolve_parameters({"heart_rate": 40, "ejection_time": 0.3})
    r = MODEL.simulate(params)
    t = np.array(r.time)
    p = np.array(r.series["aortic_pressure"])
    period = 60 / params["heart_rate"]
    # Late diastole of the first displayed beat: inflow is zero, P = Pc decays as exp(-t/RC).
    mask = (t > params["ejection_time"] + 0.1) & (t < period - 0.05)
    slope = np.polyfit(t[mask], np.log(p[mask] - params["outflow_pressure"]), 1)[0]
    rc = params["peripheral_resistance"] * params["arterial_compliance"]
    assert -1 / slope == pytest.approx(rc, rel=1e-2)


def test_reduced_compliance_widens_pulse_pressure_at_constant_mean():
    base = run()
    stiff = run(arterial_compliance=0.55)
    assert stiff.metrics["pulse_pressure"] > base.metrics["pulse_pressure"] * 1.2
    assert stiff.metrics["systolic_pressure"] > base.metrics["systolic_pressure"]
    assert stiff.metrics["diastolic_pressure"] < base.metrics["diastolic_pressure"]
    assert stiff.metrics["mean_arterial_pressure"] == pytest.approx(
        base.metrics["mean_arterial_pressure"], rel=5e-3
    )


def test_raised_resistance_raises_mean_pressure_proportionally():
    base = run()
    high = run(peripheral_resistance=1.4)
    ratio = (1.4 + 0.05) / (1.0 + 0.05)
    assert high.metrics["mean_arterial_pressure"] / base.metrics["mean_arterial_pressure"] == (
        pytest.approx(ratio, rel=5e-3)
    )


def test_numerical_convergence_under_step_refinement():
    params = MODEL.resolve_parameters({})
    coarse = MODEL.simulate(params, dt=0.001).metrics
    fine = MODEL.simulate(params, dt=0.00025).metrics
    for key in ("systolic_pressure", "diastolic_pressure", "mean_arterial_pressure"):
        assert abs(coarse[key] - fine[key]) < 0.1, key


def test_reaches_periodic_steady_state_with_default_beats():
    r = run()
    assert r.metrics["steady_state_residual"] < 0.1
    assert r.warnings == []


def test_warns_when_not_at_steady_state():
    r = run(beats=3, initial_pressure=0, arterial_compliance=4.0, peripheral_resistance=3.0)
    assert r.warnings and "steady state" in r.warnings[0]


def test_outputs_are_finite_across_parameter_extremes():
    for hr, te in ((30, 0.5), (200, 0.2)):
        for c in (0.3, 4.0):
            r = run(heart_rate=hr, ejection_time=te, arterial_compliance=c)
            assert all(math.isfinite(v) for v in r.metrics.values())
            assert all(math.isfinite(v) for v in r.series["aortic_pressure"])


def test_inflow_waveform_is_zero_in_diastole_and_non_negative():
    t = np.linspace(0, 0.8, 801)
    q = ejection_flow(t, 0.8, 0.3, 70)
    assert (q >= 0).all()
    assert (q[t >= 0.3] == 0).all()


def test_rejects_out_of_range_and_unknown_parameters():
    with pytest.raises(SimulationInputError) as exc:
        MODEL.resolve_parameters({"heart_rate": 500, "bogus": 1})
    msgs = " ".join(e["msg"] for e in exc.value.errors)
    assert "Heart rate" in msgs and "Unknown parameter 'bogus'" in msgs


def test_rejects_ejection_longer_than_cycle():
    with pytest.raises(SimulationInputError):
        MODEL.resolve_parameters({"heart_rate": 180, "ejection_time": 0.3})
