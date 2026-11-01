"""Point-cloud registration used to place SPL atlas structures in the BodyParts3D body.

The atlases come from other individuals (CT scans) in their own coordinate systems. A
reference bone present in both sources (skull + mandible, or the temporal bone) is
registered with ICP: first a similarity transform (rotation, translation, uniform
scale; Umeyama), then an affine refinement whose singular values are bounded, so the
fit can absorb individual proportions without shearing anatomy. The same transform is
then applied to the soft-tissue structures of the atlas. Quality is reported as the
residual surface distance, so placement error is measured rather than assumed.
"""

from dataclasses import dataclass

import numpy as np


@dataclass
class Registration:
    matrix: np.ndarray  # 4 x 4, source -> target
    rms_mm: float
    median_mm: float
    p90_mm: float

    def apply(self, points: np.ndarray) -> np.ndarray:
        return points @ self.matrix[:3, :3].T + self.matrix[:3, 3]


def _sample(points: np.ndarray, n: int, seed: int) -> np.ndarray:
    if len(points) <= n:
        return points
    return points[np.random.default_rng(seed).choice(len(points), n, replace=False)]


def _nearest(src: np.ndarray, dst: np.ndarray, chunk: int = 512) -> tuple[np.ndarray, np.ndarray]:
    """Index of and distance to the nearest dst point for every src point (brute force)."""
    idx = np.empty(len(src), dtype=np.int64)
    dist = np.empty(len(src))
    dst_sq = (dst**2).sum(1)
    for i in range(0, len(src), chunk):
        s = src[i : i + chunk]
        d2 = (s**2).sum(1)[:, None] + dst_sq[None, :] - 2 * s @ dst.T
        j = d2.argmin(1)
        idx[i : i + chunk] = j
        dist[i : i + chunk] = np.sqrt(np.maximum(d2[np.arange(len(s)), j], 0))
    return idx, dist


def _umeyama(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Similarity transform minimising |s R a + t - b|."""
    ma, mb = a.mean(0), b.mean(0)
    ac, bc = a - ma, b - mb
    u, sig, vt = np.linalg.svd(bc.T @ ac / len(a))
    d = np.eye(3)
    if np.linalg.det(u @ vt) < 0:
        d[2, 2] = -1
    r = u @ d @ vt
    s = np.trace(np.diag(sig) @ d) / ac.var(0).sum()
    m = np.eye(4)
    m[:3, :3] = s * r
    m[:3, 3] = mb - s * r @ ma
    return m


def _affine(
    a: np.ndarray, b: np.ndarray, bound: tuple[float, float], base_scale: float
) -> np.ndarray:
    """Least-squares affine a -> b with singular values clamped around the base scale."""
    ah = np.hstack([a, np.ones((len(a), 1))])
    sol, *_ = np.linalg.lstsq(ah, b, rcond=None)
    lin = sol[:3].T
    u, sig, vt = np.linalg.svd(lin)
    sig = np.clip(sig, base_scale * bound[0], base_scale * bound[1])
    lin = u @ np.diag(sig) @ vt
    m = np.eye(4)
    m[:3, :3] = lin
    m[:3, 3] = b.mean(0) - lin @ a.mean(0)
    return m


def register(
    source: np.ndarray,
    target: np.ndarray,
    *,
    similarity_iterations: int = 40,
    affine_iterations: int = 15,
    trim: float = 0.9,
    affine_bound: tuple[float, float] = (0.85, 1.18),
    seed: int = 7,
) -> Registration:
    """Register `source` points onto `target` points (both in millimetres)."""
    src = _sample(source, 4000, seed)
    dst = _sample(target, 12000, seed + 1)
    # Initial guess: centroids aligned, uniform scale from RMS radius (orientation is
    # expected to be roughly right already; callers convert axes first).
    s0 = np.sqrt(
        ((dst - dst.mean(0)) ** 2).sum(1).mean() / ((src - src.mean(0)) ** 2).sum(1).mean()
    )
    m = np.eye(4)
    m[:3, :3] *= s0
    m[:3, 3] = dst.mean(0) - s0 * src.mean(0)

    dst_back = _sample(dst, 4000, seed + 3)

    def step(m: np.ndarray, fit) -> np.ndarray:
        # Symmetric correspondences: source -> target alone lets the source shrink into
        # a dense part of the target; target -> source pairs penalise that collapse.
        moved = src @ m[:3, :3].T + m[:3, 3]
        j, d = _nearest(moved, dst)
        k, e = _nearest(dst_back, moved)
        keep_f = d <= np.quantile(d, trim)
        keep_b = e <= np.quantile(e, trim)
        a = np.vstack([src[keep_f], src[k[keep_b]]])
        b = np.vstack([dst[j[keep_f]], dst_back[keep_b]])
        return fit(a, b)

    for _ in range(similarity_iterations):
        m = step(m, _umeyama)
    base = float(np.cbrt(abs(np.linalg.det(m[:3, :3]))))
    for _ in range(affine_iterations):
        m = step(m, lambda a, b: _affine(a, b, affine_bound, base))
    moved = source @ m[:3, :3].T + m[:3, 3]
    _, d = _nearest(_sample(moved, 6000, seed + 2), target)
    return Registration(
        m, float(np.sqrt((d**2).mean())), float(np.median(d)), float(np.quantile(d, 0.9))
    )
