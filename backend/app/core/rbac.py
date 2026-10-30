"""Role-based access control definitions (source of truth, synced to the DB by the seeder)."""

from enum import StrEnum


class Perm(StrEnum):
    ANATOMY_READ = "anatomy:read"
    SIMULATION_RUN = "simulation:run"
    PATHOLOGY_READ = "pathology:read"
    CONTENT_EDIT = "content:edit"
    CONTENT_REVIEW = "content:review"
    COURSE_MANAGE = "course:manage"
    ANALYTICS_VIEW = "analytics:view"
    INSTITUTION_MANAGE = "institution:manage"
    AUDIT_READ = "audit:read"
    PLATFORM_ADMIN = "platform:admin"


PERMISSION_DESCRIPTIONS: dict[Perm, str] = {
    Perm.ANATOMY_READ: "Explore anatomy, structures and 3D assets",
    Perm.SIMULATION_RUN: "Run physiological and pathology simulations",
    Perm.PATHOLOGY_READ: "Explore pathology and injury content",
    Perm.CONTENT_EDIT: "Create and edit educational content drafts",
    Perm.CONTENT_REVIEW: "Review and approve medical content",
    Perm.COURSE_MANAGE: "Manage courses, assignments and examinations",
    Perm.ANALYTICS_VIEW: "View learning analytics",
    Perm.INSTITUTION_MANAGE: "Manage institutional users, departments and groups",
    Perm.AUDIT_READ: "Read audit logs",
    Perm.PLATFORM_ADMIN: "Global platform configuration",
}

_LEARNER = {Perm.ANATOMY_READ, Perm.SIMULATION_RUN, Perm.PATHOLOGY_READ}

ROLES: dict[str, tuple[str, str, set[Perm]]] = {
    "student": ("Student", "Anatomy explorer, simulations, study resources", _LEARNER),
    "doctor": ("Doctor", "Advanced reference, clinical education, pathology", _LEARNER),
    "lecturer": (
        "Lecturer",
        "Course management, assignments, examinations and analytics",
        _LEARNER | {Perm.COURSE_MANAGE, Perm.ANALYTICS_VIEW},
    ),
    "institution_admin": (
        "Institution administrator",
        "Institutional users, departments, groups and reporting",
        _LEARNER | {Perm.INSTITUTION_MANAGE, Perm.ANALYTICS_VIEW, Perm.AUDIT_READ},
    ),
    "content_expert": (
        "Content expert",
        "Anatomical content authoring, review and approval",
        _LEARNER | {Perm.CONTENT_EDIT, Perm.CONTENT_REVIEW},
    ),
    "platform_admin": ("Platform administrator", "Global platform administration", set(Perm)),
}

DEFAULT_ROLE = "student"
