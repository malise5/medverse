"""Numerical integrators."""

from collections.abc import Callable

import numpy as np

Derivative = Callable[[float, np.ndarray], np.ndarray]


def rk4(
    f: Derivative, y0: np.ndarray, t0: float, t1: float, dt: float
) -> tuple[np.ndarray, np.ndarray]:
    """Classical fixed-step 4th-order Runge-Kutta.

    Fixed steps are used deliberately: inputs such as a ventricular ejection waveform
    are piecewise-defined with known breakpoints, and a uniform grid keeps outputs on
    a regular time base for plotting and cycle-averaging. Accuracy is checked by the
    step-halving convergence test in the test suite.
    """
    if dt <= 0 or t1 <= t0:
        raise ValueError("Require dt > 0 and t1 > t0")
    n = int(round((t1 - t0) / dt))
    t = t0 + dt * np.arange(n + 1)
    y = np.empty((n + 1, np.size(y0)))
    y[0] = y0
    for i in range(n):
        ti, yi = t[i], y[i]
        k1 = f(ti, yi)
        k2 = f(ti + dt / 2, yi + dt / 2 * k1)
        k3 = f(ti + dt / 2, yi + dt / 2 * k2)
        k4 = f(ti + dt, yi + dt * k3)
        y[i + 1] = yi + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return t, y


def rk4_scalar(
    f: Callable[[float, float], float], y0: float, t0: float, t1: float, dt: float
) -> tuple[np.ndarray, np.ndarray]:
    """RK4 for a single state variable using plain floats (avoids per-step array overhead)."""
    if dt <= 0 or t1 <= t0:
        raise ValueError("Require dt > 0 and t1 > t0")
    n = int(round((t1 - t0) / dt))
    ys = [0.0] * (n + 1)
    ys[0] = y = float(y0)
    h2 = dt / 2
    for i in range(n):
        t = t0 + i * dt
        k1 = f(t, y)
        k2 = f(t + h2, y + h2 * k1)
        k3 = f(t + h2, y + h2 * k2)
        k4 = f(t + dt, y + dt * k3)
        y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        ys[i + 1] = y
    return t0 + dt * np.arange(n + 1), np.asarray(ys)
