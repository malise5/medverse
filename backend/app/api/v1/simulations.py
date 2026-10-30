import time

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession, require
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.rbac import Perm
from app.db.session import SessionLocal
from app.models import ConditionScenario, SimulationRun
from app.schemas.simulation import ModelDefinitionOut, RunRequest, RunResult
from app.services import auth_service
from app.simulation.core import SimulationInputError
from app.simulation.registry import get_model, list_models

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get(
    "/models",
    response_model=list[ModelDefinitionOut],
    dependencies=[Depends(require(Perm.ANATOMY_READ))],
)
def models():
    return [ModelDefinitionOut.from_definition(m.definition) for m in list_models()]


@router.get(
    "/models/{model_id}",
    response_model=ModelDefinitionOut,
    dependencies=[Depends(require(Perm.ANATOMY_READ))],
)
def model(model_id: str):
    return ModelDefinitionOut.from_definition(get_model(model_id).definition)


def _execute(db: Session, model_id: str, body: RunRequest, user_id) -> RunResult:
    model = get_model(model_id)
    params = dict(body.parameters)
    if body.scenario_id:
        scenario = db.get(ConditionScenario, body.scenario_id)
        if scenario is None or scenario.model_id != model_id:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "invalid_scenario",
                f"Scenario '{body.scenario_id}' does not apply to model '{model_id}'",
            )
        # Scenario overrides define the pathology; explicit user parameters still win.
        params = {**scenario.parameter_overrides, **params}
    started = time.perf_counter()
    try:
        resolved = model.resolve_parameters(params)
        result = model.simulate(resolved)
    except SimulationInputError as exc:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_parameters",
            "Simulation parameters are invalid",
            exc.errors,
        ) from exc
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    run = SimulationRun(
        user_id=user_id,
        model_id=model_id,
        model_version=model.definition.version,
        scenario_id=body.scenario_id,
        parameters=resolved,
        summary=result.metrics,
        duration_ms=elapsed_ms,
    )
    db.add(run)
    db.commit()
    return RunResult(
        run_id=run.id,
        model_id=model_id,
        model_version=model.definition.version,
        scenario_id=body.scenario_id,
        parameters=resolved,
        time=result.time,
        series=result.series,
        metrics=result.metrics,
        warnings=result.warnings,
        disclaimer=model.definition.disclaimer,
    )


@router.post("/models/{model_id}/run", response_model=RunResult)
def run(
    model_id: str,
    body: RunRequest,
    db: DbSession,
    user: CurrentUser,
    _: object = Depends(require(Perm.SIMULATION_RUN)),
):
    return _execute(db, model_id, body, user.id)


@router.websocket("/ws")
async def simulation_socket(ws: WebSocket):
    """Interactive parameter exploration over a WebSocket.

    Client sends {"model_id", "parameters", "scenario_id"?}; server replies with a
    RunResult per message, or {"error": {...}}. Authenticated by the session cookie;
    the Origin header is checked to prevent cross-site WebSocket hijacking.
    """
    settings = get_settings()
    origin = ws.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins:
        await ws.close(code=4403)
        return
    token = ws.cookies.get(settings.session_cookie_name)
    with SessionLocal() as db:
        user = auth_service.resolve_session(db, token) if token else None
        if user is None or Perm.SIMULATION_RUN not in user.permission_ids:
            await ws.close(code=4401)
            return
        user_id = user.id
    await ws.accept()
    try:
        while True:
            message = await ws.receive_json()
            try:
                model_id = str(message.get("model_id", ""))
                body = RunRequest.model_validate(
                    {k: v for k, v in message.items() if k in {"parameters", "scenario_id"}}
                )
                with SessionLocal() as db:
                    result = _execute(db, model_id, body, user_id)
                await ws.send_text(result.model_dump_json())
            except ApiError as exc:
                await ws.send_json(
                    {"error": {"code": exc.code, "message": exc.message, "details": exc.details}}
                )
            except (ValidationError, AttributeError) as exc:
                await ws.send_json({"error": {"code": "invalid_message", "message": str(exc)}})
    except WebSocketDisconnect:
        return
