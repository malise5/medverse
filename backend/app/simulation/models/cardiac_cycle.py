"""Left-ventricular cardiac cycle: time-varying elastance ventricle coupled to a WK3.

    P_lv(t)  = E(t) · (V_lv − V₀)
    E(t)     = (E_max − E_min) · Eₙ(τ / T_max) + E_min,      τ = t mod (60/HR)
    Q_mv     = (P_la − P_lv) / R_mv   if P_la > P_lv else 0   (mitral valve, ideal diode)
    Q_av     = (P_lv − P꜀) / (R_av + Z꜀)   if P_lv > P꜀ else 0   (aortic valve)
    dV_lv/dt = Q_mv − Q_av
    C dP꜀/dt = Q_av − (P꜀ − P_out) / R
    P_ao     = P꜀ + Z꜀ · Q_av

The time-varying elastance concept is from Suga, Sagawa & Shoukas (1973); the normalised
"double-Hill" elastance curve Eₙ and its coupling to a three-element Windkessel follow
Stergiopulos, Meister & Westerhof (1996).
"""

import numpy as np

from app.models.enums import EvidenceClass
from app.simulation.core import (
    AnimationBinding,
    ModelDefinition,
    OutputSpec,
    ParameterSpec,
    PhasePlot,
    ReferenceLine,
    SimulationModel,
    SimulationResult,
)

DT = 0.0005  # s; see convergence test
DISPLAY_SAMPLE = 0.005  # s

HEART, LV, RV, AORTA, LA = "FMA:7088", "FMA:7101", "FMA:7098", "FMA:3734", "FMA:7097"


def normalised_elastance(tn: float) -> float:
    """Double-Hill normalised elastance (peak ≈ 1 at tn ≈ 1), Stergiopulos et al. 1996."""
    if tn <= 0:
        return 0.0
    a = (tn / 0.7) ** 1.9
    return 1.55 * (a / (1 + a)) / (1 + (tn / 1.17) ** 21.9)


def _p(pid, label, unit, default, lo, hi, desc, step):
    return ParameterSpec(pid, label, unit, default, lo, hi, desc, step)


PV_LOOP = PhasePlot(
    id="pv_loop",
    title="Pressure-volume loop",
    x="lv_volume",
    y="lv_pressure",
    description=(
        "Each beat traces one anticlockwise loop: filling along the bottom (mitral valve open), "
        "isovolumic contraction up the right side, ejection across the top (aortic valve open) "
        "and isovolumic relaxation down the left side. Loop width is stroke volume; the area "
        "inside is the stroke work done on the blood."
    ),
    lines=[
        ReferenceLine(
            label="ESPVR",
            slope_parameter="e_max",
            x_intercept_parameter="v0",
            description=(
                "End-systolic pressure-volume relationship, P = E_max·(V − V₀). The loop's "
                "top-left corner sits on it; its slope is contractility."
            ),
        ),
        ReferenceLine(
            label="EDPVR",
            slope_parameter="e_min",
            x_intercept_parameter="v0",
            description=(
                "End-diastolic pressure-volume relationship, P = E_min·(V − V₀). Straight here "
                "because the model ventricle is linear; real ventricles stiffen as they fill."
            ),
        ),
    ],
    x_min=0,
    y_min=0,
)


DEFINITION = ModelDefinition(
    id="cv.cardiac_cycle",
    version="1.0.0",
    name="Cardiac cycle (elastance ventricle + Windkessel)",
    domain="cardiovascular",
    summary=(
        "A contracting left ventricle, described by time-varying elastance, fills through the "
        "mitral valve and ejects through the aortic valve into a three-element Windkessel."
    ),
    purpose=(
        "Show the phases of the cardiac cycle (filling, isovolumic contraction, ejection, "
        "isovolumic relaxation) and how contractility, preload and afterload change stroke "
        "volume, ejection fraction and arterial pressure."
    ),
    equations=[
        "P_lv = E(t)·(V_lv − V₀),  E(t) = (E_max − E_min)·Eₙ(τ/T_max) + E_min",
        "Eₙ(x) = 1.55 · [(x/0.7)^1.9 / (1 + (x/0.7)^1.9)] · [1 / (1 + (x/1.17)^21.9)]",
        "Q_mv = max(0, (P_la − P_lv)/R_mv);  Q_av = max(0, (P_lv − P꜀)/(R_av + Z꜀))",
        "dV_lv/dt = Q_mv − Q_av;  C·dP꜀/dt = Q_av − (P꜀ − P_out)/R;  P_ao = P꜀ + Z꜀·Q_av",
    ],
    solver=(
        f"Classical 4th-order Runge-Kutta, fixed step {DT * 1000:g} ms, run for a configurable "
        "number of beats; metrics over the final beat."
    ),
    initial_conditions="V_lv(0) = 120 mL, P꜀(0) = 80 mmHg.",
    assumptions=[
        "Only the left heart is modelled. Left-atrial pressure is a constant (preload), so "
        "atrial contraction and pulmonary circulation are not represented.",
        "Valves are ideal: no resistance to backflow (no regurgitation), no inertia, and they "
        "open and close instantly on the pressure gradient.",
        "Ventricular pressure-volume behaviour is the time-varying elastance model, which is "
        "linear in volume and independent of load.",
        "The arterial system is the same three-element Windkessel as cv.windkessel3.",
        "Default parameters are illustrative, chosen to give typical resting adult values; "
        "they are not fitted to any individual or dataset.",
    ],
    limitations=[
        "No right heart, atrial kick, baroreflex, coronary circulation or heart-rate-dependent "
        "changes in contraction timing (T_max is a direct parameter).",
        "No wave propagation or reflection in the arteries.",
        "The 3D animation scales the static heart mesh as a whole; it is a schematic cue, "
        "not a reconstruction of real cardiac wall motion.",
        "Outputs are educational illustrations, not predictions for any individual.",
    ],
    validation=[
        "Conservation: at periodic steady state, mitral inflow per beat equals aortic outflow "
        "per beat (= stroke volume) (unit test).",
        "Analytical check: mean aortic pressure equals P_out + R·mean(Q_av) + Z꜀·mean(Q_av) "
        "(unit test, < 0.5 % error).",
        "Valves never conduct backward flow; isovolumic phases exist (unit tests).",
        "Qualitative: higher preload raises stroke volume (Frank–Starling behaviour); higher "
        "E_max raises ejection fraction; higher R raises pressure and lowers stroke volume.",
        "Numerical convergence: quartering the step changes pressures by < 0.2 mmHg.",
        "Pressure-volume loop stays between the EDPVR and ESPVR lines and touches the ESPVR "
        "at end-systole (unit test).",
        "Not validated against patient data.",
    ],
    evidence_class=EvidenceClass.C_SIMPLIFIED_EDUCATIONAL,
    reference_ids=["suga1973elastance", "stergiopulos1996determinants", "westerhof2009windkessel"],
    parameters=[
        _p("heart_rate", "Heart rate", "beats/min", 75, 40, 180, "Cardiac cycles per minute.", 1),
        _p(
            "e_max",
            "Contractility (E_max)",
            "mmHg/mL",
            3.0,
            0.5,
            8.0,
            "Peak (end-systolic) elastance of the left ventricle.",
            0.1,
        ),
        _p(
            "e_min",
            "Diastolic stiffness (E_min)",
            "mmHg/mL",
            0.07,
            0.03,
            0.3,
            "Elastance of the relaxed ventricle; higher means a stiffer ventricle.",
            0.005,
        ),
        _p(
            "t_max",
            "Time to peak elastance",
            "s",
            0.30,
            0.15,
            0.45,
            "Duration of contraction up to peak elastance.",
            0.01,
        ),
        _p("v0", "Unstressed volume (V₀)", "mL", 10, 0, 40, "Volume at zero pressure.", 1),
        _p(
            "la_pressure",
            "Left-atrial pressure (preload)",
            "mmHg",
            8,
            2,
            30,
            "Filling pressure upstream of the mitral valve.",
            0.5,
        ),
        _p(
            "mitral_resistance",
            "Mitral valve resistance",
            "mmHg·s/mL",
            0.01,
            0.002,
            0.2,
            "Resistance to forward flow through the open mitral valve.",
            0.002,
        ),
        _p(
            "aortic_valve_resistance",
            "Aortic valve resistance",
            "mmHg·s/mL",
            0.005,
            0.001,
            0.2,
            "Resistance to forward flow through the open aortic valve.",
            0.001,
        ),
        _p(
            "peripheral_resistance",
            "Total peripheral resistance",
            "mmHg·s/mL",
            1.1,
            0.3,
            3.0,
            "Resistance of the systemic arterioles and capillaries.",
            0.05,
        ),
        _p(
            "arterial_compliance",
            "Total arterial compliance",
            "mL/mmHg",
            1.1,
            0.3,
            4.0,
            "Volume stored per unit pressure rise in large arteries.",
            0.05,
        ),
        _p(
            "characteristic_impedance",
            "Aortic characteristic impedance",
            "mmHg·s/mL",
            0.05,
            0.0,
            0.3,
            "Relates pressure and flow in the proximal aorta.",
            0.005,
        ),
        _p("beats", "Beats simulated", "beats", 10, 3, 30, "Cardiac cycles integrated.", 1),
    ],
    series=[
        OutputSpec("lv_pressure", "Left-ventricular pressure", "mmHg", "P_lv(t)."),
        OutputSpec("aortic_pressure", "Aortic pressure", "mmHg", "P_ao(t)."),
        OutputSpec("lv_volume", "Left-ventricular volume", "mL", "V_lv(t)."),
        OutputSpec("aortic_flow", "Aortic valve flow", "mL/s", "Q_av(t)."),
        OutputSpec("mitral_flow", "Mitral valve flow", "mL/s", "Q_mv(t)."),
    ],
    metrics=[
        OutputSpec("end_diastolic_volume", "End-diastolic volume", "mL", "Maximum V_lv."),
        OutputSpec("end_systolic_volume", "End-systolic volume", "mL", "Minimum V_lv."),
        OutputSpec("stroke_volume", "Stroke volume", "mL", "EDV − ESV."),
        OutputSpec("ejection_fraction", "Ejection fraction", "%", "SV / EDV."),
        OutputSpec("systolic_pressure", "Systolic pressure", "mmHg", "Maximum P_ao."),
        OutputSpec("diastolic_pressure", "Diastolic pressure", "mmHg", "Minimum P_ao."),
        OutputSpec("mean_arterial_pressure", "Mean arterial pressure", "mmHg", "Mean P_ao."),
        OutputSpec("peak_lv_pressure", "Peak LV pressure", "mmHg", "Maximum P_lv."),
        OutputSpec("cardiac_output", "Cardiac output", "L/min", "SV × HR."),
        OutputSpec(
            "steady_state_residual",
            "Steady-state residual",
            "mL",
            "|V_lv(end) − V_lv(start)| over the final beat.",
        ),
    ],
    linked_structure_ids=[HEART, LV, RV, LA, AORTA],
    visual_mappings={"lv_volume": [HEART], "lv_pressure": [LV], "aortic_pressure": [AORTA]},
    phase_plots=[PV_LOOP],
    animations=[
        AnimationBinding(
            output="lv_volume",
            structure_ids=[HEART],
            effect="scale",
            amplitude=0.05,
            description=(
                "The whole heart mesh grows and shrinks with model left-ventricular volume "
                "(±5 %, exaggerated for visibility). Real hearts deform unevenly, and the atria "
                "fill while the ventricles empty."
            ),
        ),
        AnimationBinding(
            output="lv_pressure",
            structure_ids=[LV],
            effect="tint",
            amplitude=0.9,
            color="#ff4d3d",
            description="The left ventricle turns red as its pressure rises during contraction.",
        ),
        AnimationBinding(
            output="aortic_pressure",
            structure_ids=[AORTA],
            effect="tint",
            amplitude=0.8,
            color="#ff4d3d",
            description=(
                "The aorta brightens with aortic pressure (all at once: the model has no "
                "pulse-wave travel)."
            ),
        ),
    ],
)


class CardiacCycle(SimulationModel):
    definition = DEFINITION

    def cross_validate(self, values: dict[str, float]) -> list[dict]:
        period = 60.0 / values["heart_rate"]
        # Contraction plus relaxation spans roughly 1.6·T_max; leave time to refill.
        if values["t_max"] * 1.6 >= 0.9 * period:
            return [
                {
                    "loc": ["parameters", "t_max"],
                    "msg": (
                        f"Time to peak elastance is too long for {values['heart_rate']:g} "
                        f"beats/min; it must be below {0.9 * period / 1.6:.2f} s"
                    ),
                }
            ]
        if values["e_max"] <= values["e_min"]:
            return [{"loc": ["parameters", "e_max"], "msg": "E_max must exceed E_min"}]
        return []

    def simulate(self, params: dict[str, float], dt: float = DT) -> SimulationResult:
        hr = params["heart_rate"]
        e_max, e_min, t_max = params["e_max"], params["e_min"], params["t_max"]
        v0, p_la = params["v0"], params["la_pressure"]
        r_mv, r_av = params["mitral_resistance"], params["aortic_valve_resistance"]
        r, c, zc = (
            params["peripheral_resistance"],
            params["arterial_compliance"],
            params["characteristic_impedance"],
        )
        beats = int(params["beats"])
        period = 60.0 / hr

        def flows(t: float, v: float, pc: float) -> tuple[float, float, float]:
            e = (e_max - e_min) * normalised_elastance((t % period) / t_max) + e_min
            p_lv = e * (v - v0)
            q_mv = (p_la - p_lv) / r_mv if p_la > p_lv else 0.0
            q_av = (p_lv - pc) / (r_av + zc) if p_lv > pc else 0.0
            return p_lv, q_mv, q_av

        def deriv(t: float, v: float, pc: float) -> tuple[float, float]:
            _, q_mv, q_av = flows(t, v, pc)
            return q_mv - q_av, (q_av - pc / r) / c

        n = int(round(beats * period / dt))
        vs, pcs = [0.0] * (n + 1), [0.0] * (n + 1)
        v, pc = 120.0, 80.0
        vs[0], pcs[0] = v, pc
        h2 = dt / 2
        for i in range(n):
            t = i * dt
            a1, b1 = deriv(t, v, pc)
            a2, b2 = deriv(t + h2, v + h2 * a1, pc + h2 * b1)
            a3, b3 = deriv(t + h2, v + h2 * a2, pc + h2 * b2)
            a4, b4 = deriv(t + dt, v + dt * a3, pc + dt * b3)
            v += dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4)
            pc += dt / 6 * (b1 + 2 * b2 + 2 * b3 + b4)
            vs[i + 1], pcs[i + 1] = v, pc

        t = dt * np.arange(n + 1)
        out = np.array([flows(ti, vi, pi) for ti, vi, pi in zip(t, vs, pcs, strict=True)])
        p_lv, q_mv, q_av = out[:, 0], out[:, 1], out[:, 2]
        vol, pcv = np.asarray(vs), np.asarray(pcs)
        p_ao = pcv + zc * q_av

        last = t >= (beats - 1) * period - 1e-9
        v_last, pa_last = vol[last], p_ao[last]
        edv, esv = float(v_last.max()), float(v_last.min())
        sv = edv - esv
        residual = float(abs(v_last[-1] - v_last[0]))
        warnings = []
        if residual > 0.5:
            warnings.append(
                f"Final beat not at periodic steady state (residual {residual:.2f} mL); "
                "increase 'beats simulated'."
            )

        shown = min(3, beats)
        window = t >= (beats - shown) * period - 1e-9
        stride = max(1, int(round(DISPLAY_SAMPLE / dt)))
        idx = np.flatnonzero(window)[::stride]
        t0 = t[idx[0]]

        def rounded(a: np.ndarray, nd: int = 3) -> list[float]:
            return [round(float(x), nd) for x in a]

        return SimulationResult(
            time=rounded(t[idx] - t0, 4),
            series={
                "lv_pressure": rounded(p_lv[idx]),
                "aortic_pressure": rounded(p_ao[idx]),
                "lv_volume": rounded(vol[idx]),
                "aortic_flow": rounded(q_av[idx]),
                "mitral_flow": rounded(q_mv[idx]),
            },
            metrics={
                "end_diastolic_volume": round(edv, 2),
                "end_systolic_volume": round(esv, 2),
                "stroke_volume": round(sv, 2),
                "ejection_fraction": round(100 * sv / edv, 1) if edv > 0 else 0.0,
                "systolic_pressure": round(float(pa_last.max()), 2),
                "diastolic_pressure": round(float(pa_last.min()), 2),
                "mean_arterial_pressure": round(
                    float(np.trapezoid(pa_last, dx=dt) / (dt * (len(pa_last) - 1))), 2
                ),
                "peak_lv_pressure": round(float(p_lv[last].max()), 2),
                "cardiac_output": round(sv * hr / 1000.0, 3),
                "steady_state_residual": round(residual, 3),
            },
            warnings=warnings,
        )
