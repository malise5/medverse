"""Hodgkin–Huxley membrane action potential (single isopotential patch).

    C_m dV/dt = I_stim − g_Na·m³h·(V − E_Na) − g_K·n⁴·(V − E_K) − g_L·(V − E_L)
    dx/dt     = α_x(V)·(1 − x) − β_x(V)·x,        x ∈ {m, h, n}

Rate functions and conductances are those of Hodgkin & Huxley (1952) for the squid giant
axon at 6.3 °C, written in the modern sign convention with the resting potential shifted
to −65 mV (E_L chosen so that rest is exactly −65 mV).
"""

import math

import numpy as np

from app.models.enums import EvidenceClass
from app.simulation.core import (
    AnimationBinding,
    ModelDefinition,
    OutputSpec,
    ParameterSpec,
    SimulationModel,
    SimulationResult,
)

DT = 0.01  # ms
DISPLAY_SAMPLE = 0.1  # ms
E_NA, E_K, E_L = 50.0, -77.0, -54.387
G_L, C_M = 0.3, 1.0
V_REST = -65.0

BRAIN, SPINAL_CORD = "FMA:50801", "FMA:7647"


def _vtrap(x: float, y: float) -> float:
    """x / (1 − exp(−x/y)), with its limit y at x = 0."""
    if abs(x / y) < 1e-6:
        return y * (1 + x / y / 2)
    return x / (1 - math.exp(-x / y))


def rates(v: float) -> tuple[float, float, float, float, float, float]:
    a_m = 0.1 * _vtrap(v + 40, 10)
    b_m = 4.0 * math.exp(-(v + 65) / 18)
    a_h = 0.07 * math.exp(-(v + 65) / 20)
    b_h = 1.0 / (1 + math.exp(-(v + 35) / 10))
    a_n = 0.01 * _vtrap(v + 55, 10)
    b_n = 0.125 * math.exp(-(v + 65) / 80)
    return a_m, b_m, a_h, b_h, a_n, b_n


def steady_state(v: float) -> tuple[float, float, float]:
    a_m, b_m, a_h, b_h, a_n, b_n = rates(v)
    return a_m / (a_m + b_m), a_h / (a_h + b_h), a_n / (a_n + b_n)


DEFINITION = ModelDefinition(
    id="neuro.hodgkin_huxley",
    version="1.0.0",
    name="Nerve action potential (Hodgkin–Huxley)",
    domain="nervous",
    summary=(
        "Voltage-gated sodium and potassium conductances turn a brief stimulus into an "
        "all-or-none action potential in a patch of axon membrane."
    ),
    purpose=(
        "Show threshold, the all-or-none spike, the roles of sodium activation (m), sodium "
        "inactivation (h) and potassium activation (n), and refractoriness."
    ),
    equations=[
        "C_m·dV/dt = I_stim − g_Na·m³·h·(V − E_Na) − g_K·n⁴·(V − E_K) − g_L·(V − E_L)",
        "dx/dt = α_x(V)·(1 − x) − β_x(V)·x,   x ∈ {m, h, n}",
        "α_m = 0.1(V+40)/(1 − e^(−(V+40)/10)),  β_m = 4·e^(−(V+65)/18)",
        "α_h = 0.07·e^(−(V+65)/20),  β_h = 1/(1 + e^(−(V+35)/10))",
        "α_n = 0.01(V+55)/(1 − e^(−(V+55)/10)),  β_n = 0.125·e^(−(V+65)/80)",
        f"E_Na = {E_NA:g}, E_K = {E_K:g}, E_L = {E_L:g} mV;  g_L = {G_L:g} mS/cm²; "
        f"C_m = {C_M:g} µF/cm²",
    ],
    solver=f"Classical 4th-order Runge-Kutta, fixed step {DT:g} ms.",
    initial_conditions="V(0) = −65 mV with m, h, n at their steady-state values.",
    assumptions=[
        "A single isopotential patch of membrane: there is no propagation along an axon.",
        "Original squid giant axon kinetics at 6.3 °C; mammalian neurons have other channel "
        "types and faster kinetics.",
        "Stimulus is a train of identical rectangular current pulses.",
    ],
    limitations=[
        "Does not model conduction velocity, myelination, synapses or networks.",
        "The 3D glow on the brain and spinal cord only marks the timing of this one model "
        "membrane's spikes. It does not show real brain activity, which involves billions "
        "of neurons firing in complex patterns.",
        "Outputs are educational illustrations, not predictions for any individual.",
    ],
    validation=[
        "Rest: without stimulus, V stays at −65 mV (unit test, < 0.1 mV drift).",
        "Threshold: a weak 1 ms pulse gives no spike; a strong one gives a full spike "
        "(unit tests).",
        "Spike peak lies between +30 and +50 mV, below E_Na (unit test).",
        "Refractoriness: a second pulse 3 ms after the first does not fire; one 30 ms "
        "later does (unit test).",
        "Gating variables remain in [0, 1]; quartering the step changes the peak by < 0.5 mV.",
        "Not validated against human neurons.",
    ],
    evidence_class=EvidenceClass.C_SIMPLIFIED_EDUCATIONAL,
    reference_ids=["hodgkin1952quantitative"],
    parameters=[
        ParameterSpec(
            "stim_amplitude",
            "Stimulus current",
            "µA/cm²",
            10.0,
            0.0,
            50.0,
            "Amplitude of each rectangular stimulus pulse.",
            0.5,
        ),
        ParameterSpec(
            "stim_width", "Pulse width", "ms", 1.0, 0.1, 5.0, "Duration of each pulse.", 0.1
        ),
        ParameterSpec(
            "stim_interval",
            "Pulse interval",
            "ms",
            20.0,
            2.0,
            100.0,
            "Time between the starts of successive pulses.",
            0.5,
        ),
        ParameterSpec("duration", "Duration", "ms", 60.0, 10.0, 200.0, "Time simulated.", 5),
        ParameterSpec(
            "g_na",
            "Max sodium conductance",
            "mS/cm²",
            120.0,
            0.0,
            240.0,
            "Lower values mimic partial sodium-channel block.",
            5,
        ),
        ParameterSpec(
            "g_k",
            "Max potassium conductance",
            "mS/cm²",
            36.0,
            0.0,
            72.0,
            "Lower values mimic partial potassium-channel block.",
            1,
        ),
    ],
    series=[
        OutputSpec("membrane_potential", "Membrane potential", "mV", "V(t)."),
        OutputSpec("stimulus", "Stimulus current", "µA/cm²", "I_stim(t)."),
        OutputSpec("m_gate", "Na⁺ activation (m)", "", "Probability, 0–1."),
        OutputSpec("h_gate", "Na⁺ inactivation (h)", "", "Probability, 0–1."),
        OutputSpec("n_gate", "K⁺ activation (n)", "", "Probability, 0–1."),
    ],
    metrics=[
        OutputSpec("spike_count", "Spikes", "", "Upward crossings of 0 mV."),
        OutputSpec("peak_potential", "Peak potential", "mV", "Maximum V."),
        OutputSpec("resting_potential", "Resting potential", "mV", "V at t = 0."),
        OutputSpec(
            "first_spike_latency",
            "First-spike latency",
            "ms",
            "Time from first pulse to first 0 mV crossing; −1 if none.",
        ),
    ],
    linked_structure_ids=[BRAIN, SPINAL_CORD],
    visual_mappings={"membrane_potential": [BRAIN, SPINAL_CORD]},
    animations=[
        AnimationBinding(
            output="membrane_potential",
            structure_ids=[BRAIN, SPINAL_CORD],
            effect="glow",
            amplitude=1.0,
            color="#ffd54a",
            description=(
                "The brain and spinal cord flash when the model membrane fires. This marks spike "
                "timing only; it is not a picture of real brain activity."
            ),
        ),
    ],
    time_unit="ms",
    playback_rate=15.0,  # 15 ms of model time per second: slowed ≈ 67×
)


class HodgkinHuxley(SimulationModel):
    definition = DEFINITION

    def cross_validate(self, values: dict[str, float]) -> list[dict]:
        if values["stim_width"] >= values["stim_interval"]:
            return [
                {
                    "loc": ["parameters", "stim_width"],
                    "msg": "Pulse width must be shorter than the pulse interval",
                }
            ]
        return []

    def simulate(self, params: dict[str, float], dt: float = DT) -> SimulationResult:
        amp, width, interval = (
            params["stim_amplitude"],
            params["stim_width"],
            params["stim_interval"],
        )
        g_na, g_k = params["g_na"], params["g_k"]
        onset = 5.0  # ms of rest before the first pulse

        def stim(t: float) -> float:
            return amp if t >= onset and (t - onset) % interval < width else 0.0

        def deriv(t: float, y: tuple[float, float, float, float]):
            v, m, h, n = y
            a_m, b_m, a_h, b_h, a_n, b_n = rates(v)
            i_ion = g_na * m**3 * h * (v - E_NA) + g_k * n**4 * (v - E_K) + G_L * (v - E_L)
            return (
                (stim(t) - i_ion) / C_M,
                a_m * (1 - m) - b_m * m,
                a_h * (1 - h) - b_h * h,
                a_n * (1 - n) - b_n * n,
            )

        steps = int(round(params["duration"] / dt))
        y = (V_REST, *steady_state(V_REST))
        out = np.empty((steps + 1, 4))
        out[0] = y
        h2 = dt / 2
        for i in range(steps):
            t = i * dt
            k1 = deriv(t, y)
            k2 = deriv(t + h2, tuple(a + h2 * b for a, b in zip(y, k1, strict=True)))
            k3 = deriv(t + h2, tuple(a + h2 * b for a, b in zip(y, k2, strict=True)))
            k4 = deriv(t + dt, tuple(a + dt * b for a, b in zip(y, k3, strict=True)))
            y = tuple(
                a + dt / 6 * (b1 + 2 * b2 + 2 * b3 + b4)
                for a, b1, b2, b3, b4 in zip(y, k1, k2, k3, k4, strict=True)
            )
            out[i + 1] = y

        t = dt * np.arange(steps + 1)
        v = out[:, 0]
        up = np.flatnonzero((v[:-1] < 0) & (v[1:] >= 0))
        stride = max(1, int(round(DISPLAY_SAMPLE / dt)))
        idx = np.arange(0, steps + 1, stride)

        def rounded(a: np.ndarray, nd: int = 3) -> list[float]:
            return [round(float(x), nd) for x in a]

        return SimulationResult(
            time=rounded(t[idx], 2),
            series={
                "membrane_potential": rounded(v[idx]),
                "stimulus": rounded(np.array([stim(x) for x in t[idx]])),
                "m_gate": rounded(out[idx, 1], 4),
                "h_gate": rounded(out[idx, 2], 4),
                "n_gate": rounded(out[idx, 3], 4),
            },
            metrics={
                "spike_count": float(len(up)),
                "peak_potential": round(float(v.max()), 2),
                "resting_potential": round(float(v[0]), 2),
                "first_spike_latency": round(float(t[up[0]] - onset), 2) if len(up) else -1.0,
            },
        )
