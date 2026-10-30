"""Three-element Windkessel (WK3) model of the systemic arterial circulation.

    Q(t)            : left-ventricular outflow into the aorta (prescribed)
    C dPc/dt        = Q(t) - (Pc - Pout) / R
    P(t)            = Pc(t) + Zc * Q(t)          (proximal aortic pressure)

Zc is the characteristic impedance of the proximal aorta, R the total peripheral
resistance, C the total arterial compliance and Pout the pressure at the distal end
of R. See Westerhof, Lankhaar & Westerhof (2009) for the model's derivation and
interpretation.
"""

import math

import numpy as np

from app.models.enums import EvidenceClass
from app.simulation.core import (
    ModelDefinition,
    OutputSpec,
    ParameterSpec,
    SimulationModel,
    SimulationResult,
)
from app.simulation.solvers import rk4_scalar

DT = 0.001  # s; see convergence test (dt vs dt/4 agree to < 0.1 mmHg)
DISPLAY_SAMPLE = 0.005  # s between returned samples

DEFINITION = ModelDefinition(
    id="cv.windkessel3",
    version="1.0.0",
    name="Systemic arterial Windkessel (3-element)",
    domain="cardiovascular",
    summary=(
        "Lumped-parameter model relating left-ventricular ejection to aortic pressure "
        "through peripheral resistance, arterial compliance and aortic characteristic "
        "impedance."
    ),
    purpose=(
        "Teach how stroke volume, heart rate, peripheral resistance and arterial "
        "compliance determine systolic, diastolic, mean and pulse pressure."
    ),
    equations=[
        "Q(t) = Q₀·sin(π·τ/Tₑ) for 0 ≤ τ < Tₑ, else 0;  τ = t mod (60/HR);  Q₀ = π·SV/(2·Tₑ)",
        "C · dP꜀/dt = Q(t) − (P꜀ − P_out) / R",
        "P_aorta(t) = P꜀(t) + Z꜀ · Q(t)",
        "Periodic steady state:  MAP = P_out + (R + Z꜀) · SV · HR / 60",
    ],
    solver=(
        f"Classical 4th-order Runge-Kutta, fixed step {DT * 1000:g} ms, integrated for a "
        "configurable number of beats so the transient (time constant R·C) decays; "
        "metrics are computed over the final beat."
    ),
    initial_conditions="P꜀(0) = initial pressure parameter (default 80 mmHg).",
    assumptions=[
        "Ventricular outflow is a prescribed half-sine wave; the ventricle is not modelled, "
        "so there is no ventricular-arterial coupling (afterload does not alter stroke volume).",
        "The entire systemic arterial tree is lumped into three elements; there is no wave "
        "propagation or reflection, so pressure is the same everywhere in the 'aorta'.",
        "Compliance and resistance are constant (linear) over the pressure range.",
        "Aortic valve closure is implied by zero outflow in diastole; there is no regurgitation.",
        "Default parameter values are illustrative, chosen to give typical resting adult "
        "pressures; they are not fitted to any individual or dataset.",
    ],
    limitations=[
        "Cannot represent pulse-wave velocity, wave reflection or pressure amplification "
        "between central and peripheral arteries.",
        "Cannot represent compensatory reflexes (baroreflex), changes in stroke volume caused "
        "by altered afterload, or valvular disease.",
        "Not a computational fluid dynamics model; it predicts no spatial flow field.",
        "Outputs are educational illustrations, not predictions for any individual.",
    ],
    validation=[
        "Analytical check: cycle-averaged pressure equals P_out + (R + Z꜀)·mean flow at "
        "periodic steady state (unit test, < 0.5 % error).",
        "Analytical check: diastolic pressure decays exponentially with time constant R·C "
        "(unit test).",
        "Conservation: integrated ejection per beat equals the stroke volume parameter.",
        "Numerical convergence: halving/quartering the step changes outputs by < 0.1 mmHg.",
        "Qualitative behaviour (lower compliance → wider pulse pressure at unchanged mean "
        "flow) agrees with Westerhof et al. (2009). Not validated against patient data.",
    ],
    evidence_class=EvidenceClass.C_SIMPLIFIED_EDUCATIONAL,
    reference_ids=["westerhof2009windkessel"],
    parameters=[
        ParameterSpec(
            "heart_rate", "Heart rate", "beats/min", 75, 30, 200, "Cardiac cycles per minute.", 1
        ),
        ParameterSpec(
            "stroke_volume",
            "Stroke volume",
            "mL",
            70,
            10,
            150,
            "Volume ejected into the aorta per beat.",
            1,
        ),
        ParameterSpec(
            "ejection_time",
            "Ejection duration",
            "s",
            0.30,
            0.10,
            0.50,
            "Duration of ventricular ejection in each beat.",
            0.01,
        ),
        ParameterSpec(
            "peripheral_resistance",
            "Total peripheral resistance",
            "mmHg·s/mL",
            1.0,
            0.3,
            3.0,
            "Resistance of the systemic arterioles and capillaries.",
            0.05,
        ),
        ParameterSpec(
            "arterial_compliance",
            "Total arterial compliance",
            "mL/mmHg",
            1.1,
            0.3,
            4.0,
            "Volume stored per unit pressure rise in large arteries.",
            0.05,
        ),
        ParameterSpec(
            "characteristic_impedance",
            "Aortic characteristic impedance",
            "mmHg·s/mL",
            0.05,
            0.0,
            0.3,
            "Relates pressure and flow in the proximal aorta.",
            0.005,
        ),
        ParameterSpec(
            "outflow_pressure",
            "Distal (outflow) pressure",
            "mmHg",
            0,
            0,
            20,
            "Pressure at the distal end of the peripheral resistance.",
            1,
        ),
        ParameterSpec(
            "initial_pressure",
            "Initial arterial pressure",
            "mmHg",
            80,
            0,
            200,
            "Starting value of the compliance pressure.",
            1,
        ),
        ParameterSpec(
            "beats",
            "Beats simulated",
            "beats",
            12,
            3,
            40,
            "Number of cardiac cycles integrated before reporting.",
            1,
        ),
    ],
    series=[
        OutputSpec("aortic_pressure", "Aortic pressure", "mmHg", "Proximal aortic pressure P(t)."),
        OutputSpec("aortic_inflow", "Ventricular ejection", "mL/s", "Prescribed inflow Q(t)."),
        OutputSpec(
            "peripheral_outflow",
            "Peripheral outflow",
            "mL/s",
            "Flow through the peripheral resistance (P꜀ − P_out)/R.",
        ),
    ],
    metrics=[
        OutputSpec("systolic_pressure", "Systolic pressure", "mmHg", "Maximum over final beat."),
        OutputSpec("diastolic_pressure", "Diastolic pressure", "mmHg", "Minimum over final beat."),
        OutputSpec("pulse_pressure", "Pulse pressure", "mmHg", "Systolic − diastolic."),
        OutputSpec(
            "mean_arterial_pressure",
            "Mean arterial pressure",
            "mmHg",
            "Time-average over final beat.",
        ),
        OutputSpec("cardiac_output", "Cardiac output", "L/min", "SV × HR."),
        OutputSpec(
            "ejected_volume",
            "Ejected volume (numerical)",
            "mL",
            "Integral of Q over final beat; should equal stroke volume.",
        ),
        OutputSpec(
            "time_constant",
            "Diastolic time constant (R·C)",
            "s",
            "Characteristic decay time of diastolic pressure.",
        ),
        OutputSpec(
            "steady_state_residual",
            "Steady-state residual",
            "mmHg",
            "|P꜀(end) − P꜀(start)| of the final beat; small means periodic steady state.",
        ),
    ],
    linked_structure_ids=["FMA:3734", "FMA:7088", "FMA:7101", "FMA:3736", "FMA:3768"],
    visual_mappings={
        "aortic_pressure": ["FMA:3734", "FMA:3736", "FMA:3768"],
        "aortic_inflow": ["FMA:7101"],
    },
)


def ejection_flow(t: np.ndarray | float, period: float, t_ej: float, sv: float):
    tau = np.mod(t, period)
    q0 = math.pi * sv / (2 * t_ej)
    return np.where(tau < t_ej, q0 * np.sin(math.pi * tau / t_ej), 0.0)


class Windkessel3(SimulationModel):
    definition = DEFINITION

    def cross_validate(self, values: dict[str, float]) -> list[dict]:
        period = 60.0 / values["heart_rate"]
        if values["ejection_time"] >= 0.8 * period:
            return [
                {
                    "loc": ["parameters", "ejection_time"],
                    "msg": (
                        f"Ejection duration must be shorter than 80 % of the cardiac cycle "
                        f"({0.8 * period:.2f} s at {values['heart_rate']:g} beats/min)"
                    ),
                }
            ]
        return []

    def simulate(self, params: dict[str, float], dt: float = DT) -> SimulationResult:
        hr, sv, t_ej = params["heart_rate"], params["stroke_volume"], params["ejection_time"]
        r, c, zc = (
            params["peripheral_resistance"],
            params["arterial_compliance"],
            params["characteristic_impedance"],
        )
        p_out = params["outflow_pressure"]
        beats = int(params["beats"])
        period = 60.0 / hr

        q0 = math.pi * sv / (2 * t_ej)

        def deriv(t: float, pc: float) -> float:
            tau = t % period
            q = q0 * math.sin(math.pi * tau / t_ej) if tau < t_ej else 0.0
            return (q - (pc - p_out) / r) / c

        t, pc = rk4_scalar(deriv, params["initial_pressure"], 0.0, beats * period, dt)
        q = ejection_flow(t, period, t_ej, sv)
        p = pc + zc * q
        q_out = (pc - p_out) / r

        last = t >= (beats - 1) * period - 1e-9
        p_last, q_last = p[last], q[last]
        # Trapezoidal averages over the final beat (uniform grid).
        mean_p = float(np.trapezoid(p_last, dx=dt) / period)
        ejected = float(np.trapezoid(q_last, dx=dt))
        residual = float(abs(pc[last][-1] - pc[last][0]))

        warnings = []
        if residual > 0.5:
            warnings.append(
                f"Final beat not at periodic steady state (residual {residual:.2f} mmHg); "
                "increase 'beats simulated'."
            )

        # Return the last three beats (or fewer), downsampled, re-zeroed in time.
        shown = min(3, beats)
        window = t >= (beats - shown) * period - 1e-9
        stride = max(1, int(round(DISPLAY_SAMPLE / dt)))
        idx = np.flatnonzero(window)[::stride]
        t0 = t[idx[0]]

        def rounded(a: np.ndarray, nd: int = 3) -> list[float]:
            return [round(float(v), nd) for v in a]

        return SimulationResult(
            time=rounded(t[idx] - t0, 4),
            series={
                "aortic_pressure": rounded(p[idx]),
                "aortic_inflow": rounded(q[idx]),
                "peripheral_outflow": rounded(q_out[idx]),
            },
            metrics={
                "systolic_pressure": round(float(p_last.max()), 2),
                "diastolic_pressure": round(float(p_last.min()), 2),
                "pulse_pressure": round(float(p_last.max() - p_last.min()), 2),
                "mean_arterial_pressure": round(mean_p, 2),
                "cardiac_output": round(sv * hr / 1000.0, 3),
                "ejected_volume": round(ejected, 2),
                "time_constant": round(r * c, 3),
                "steady_state_residual": round(residual, 3),
            },
            warnings=warnings,
        )
