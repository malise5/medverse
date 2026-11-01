"""Learning modules and quizzes: content validation (seed) and API shapes.

The `*In` models validate version-controlled JSON in ``content/learning`` before it is
loaded; anything that does not match is reported as a content-integrity problem.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import AudienceLevel, VerificationStatus
from app.schemas.anatomy import ReferenceOut

NonEmpty = Annotated[str, Field(min_length=1)]
LEVELS: tuple[AudienceLevel, ...] = (
    AudienceLevel.BASIC,
    AudienceLevel.UNDERGRADUATE,
    AudienceLevel.CLINICAL,
)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LevelText(_Strict):
    """The same idea explained at three depths; each level is self-contained."""

    basic: NonEmpty
    undergraduate: NonEmpty
    clinical: NonEmpty


class FunctionItem(_Strict):
    title: NonEmpty
    body: NonEmpty


class OrganItem(_Strict):
    name: NonEmpty
    latin: str | None = None
    # null when the organ is not (yet) in the 3D asset set; the UI says so
    structure_id: str | None = None
    role: NonEmpty


class Interaction(_Strict):
    system: NonEmpty
    body: NonEmpty


class KeyTerm(_Strict):
    term: NonEmpty
    latin: str | None = None
    # Greek/Latin word roots help learners whose first language is not English
    origin: str | None = None
    definition: NonEmpty


class Fact(_Strict):
    label: NonEmpty
    value: NonEmpty
    note: str | None = None


class ModuleBody(_Strict):
    latin_name: str | None = None
    objectives: list[NonEmpty] = Field(min_length=2)
    overview: LevelText
    functions: list[FunctionItem] = Field(min_length=2)
    organs: list[OrganItem] = Field(min_length=2)
    works_with: list[Interaction] = Field(min_length=2)
    key_terms: list[KeyTerm] = Field(min_length=3)
    facts: list[Fact] = Field(default_factory=list)
    clinical_notes: list[NonEmpty] = Field(default_factory=list)
    asset_note: str | None = None


class ModuleIn(_Strict):
    id: NonEmpty
    title: NonEmpty
    tagline: NonEmpty
    display_order: int
    body: ModuleBody
    references: list[NonEmpty] = Field(min_length=1)


class QuestionIn(_Strict):
    id: Annotated[str, Field(min_length=1, max_length=64)]
    module: NonEmpty
    kind: Literal["mcq", "identify"]
    level: Literal["basic", "undergraduate", "clinical"]
    stem: NonEmpty
    options: list[NonEmpty] | None = None
    answer: int | list[NonEmpty]
    explanation: NonEmpty
    references: list[NonEmpty] = Field(min_length=1)

    @model_validator(mode="after")
    def _shape(self) -> "QuestionIn":
        if self.kind == "mcq":
            if not self.options or len(self.options) < 3:
                raise ValueError("mcq needs at least three options")
            if len(set(self.options)) != len(self.options):
                raise ValueError("mcq options must be distinct")
            if not isinstance(self.answer, int) or not 0 <= self.answer < len(self.options):
                raise ValueError("mcq answer must be the index of an option")
        else:
            if self.options is not None:
                raise ValueError("identify questions have no options")
            if not isinstance(self.answer, list) or not self.answer:
                raise ValueError("identify answer must be a non-empty list of structure IDs")
        return self


# --- API -------------------------------------------------------------------------


class Progress(BaseModel):
    questions: int
    answered: int
    correct: int


class ModuleSummary(BaseModel):
    id: str
    title: str
    tagline: str
    # Translation of this module into the requested language: "source" (English),
    # "complete", "partial" (the rest is shown in English) or "missing".
    translation: str = "source"
    latin_name: str | None
    display_order: int
    structure_count: int
    mesh_count: int
    progress: Progress


class OrganOut(OrganItem):
    in_3d: bool
    structure_name: str | None
    # bodies whose 3D model contains the organ (e.g. ["female"] for the uterus)
    body_models: list[str] = []


class QuestionOut(BaseModel):
    """A question without its answer; answers are checked by the server."""

    id: str
    kind: Literal["mcq", "identify"]
    level: str
    stem: str
    options: list[str] | None
    last_correct: bool | None
    # identify questions: bodies in which an accepted structure can be selected
    body_models: list[str] = []


class ModuleDetail(BaseModel):
    id: str
    title: str
    tagline: str
    translation: str = "source"  # see ModuleSummary.translation
    latin_name: str | None
    objectives: list[str]
    overview: LevelText
    functions: list[FunctionItem]
    organs: list[OrganOut]
    works_with: list[Interaction]
    key_terms: list[KeyTerm]
    facts: list[Fact]
    clinical_notes: list[str]
    asset_note: str | None
    questions: list[QuestionOut]
    references: list[ReferenceOut]
    verification_status: VerificationStatus
    progress: Progress


class AnswerIn(BaseModel):
    # option index (mcq) or the selected structure ID (identify)
    response: Annotated[str, Field(min_length=1, max_length=64)]


class AnswerOut(BaseModel):
    correct: bool
    # mcq: index of the right option; identify: accepted structure IDs and names
    correct_option: int | None
    accepted: list[dict]
    explanation: str
    references: list[ReferenceOut]


class GlossaryEntry(KeyTerm):
    module_id: str
    module_title: str
