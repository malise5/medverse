from collections.abc import Iterable

from app.core.errors import not_found
from app.simulation.core import SimulationModel
from app.simulation.models.cardiac_cycle import CardiacCycle
from app.simulation.models.hodgkin_huxley import HodgkinHuxley
from app.simulation.models.respiratory import SingleCompartmentLung
from app.simulation.models.windkessel import Windkessel3

# Order matters: for a structure, the first linked model is its primary "function" model.
_MODELS: dict[str, SimulationModel] = {
    m.definition.id: m
    for m in [CardiacCycle(), SingleCompartmentLung(), HodgkinHuxley(), Windkessel3()]
}


def list_models() -> list[SimulationModel]:
    return list(_MODELS.values())


def get_model(model_id: str) -> SimulationModel:
    try:
        return _MODELS[model_id]
    except KeyError:
        raise not_found("Simulation model", model_id) from None


def models_for_structure(
    structure_id: str, ancestor_ids: Iterable[str] = ()
) -> list[SimulationModel]:
    """Models linked to the structure itself or to any structure it is part of."""
    ids = {structure_id, *ancestor_ids}
    return [m for m in _MODELS.values() if ids & set(m.definition.linked_structure_ids)]
