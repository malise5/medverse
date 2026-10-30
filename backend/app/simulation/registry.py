from app.core.errors import not_found
from app.simulation.core import SimulationModel
from app.simulation.models.windkessel import Windkessel3

_MODELS: dict[str, SimulationModel] = {m.definition.id: m for m in [Windkessel3()]}


def list_models() -> list[SimulationModel]:
    return list(_MODELS.values())


def get_model(model_id: str) -> SimulationModel:
    try:
        return _MODELS[model_id]
    except KeyError:
        raise not_found("Simulation model", model_id) from None


def models_for_structure(structure_id: str) -> list[SimulationModel]:
    return [m for m in _MODELS.values() if structure_id in m.definition.linked_structure_ids]
