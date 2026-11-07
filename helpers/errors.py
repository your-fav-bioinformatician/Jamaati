"""How the engine reports bad input or state: fail() logs and raises EngineError, which
run_engine() turns into an HTTP 500 carrying the message."""
import logging
from typing import Any, NoReturn

from fastapi import HTTPException

log = logging.getLogger("engine")


class EngineError(RuntimeError):
    """Raised by fail()."""


def fail(message: str) -> NoReturn:
    log.error(message)
    raise EngineError(message)


def require(value: Any, name: str, message: str | None = None) -> Any:
    """`value`, unless it is None or a blank string (then fail)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        fail(message or f"{name} is missing")
    return value


async def run_engine(coro, what: str) -> Any:
    """Await an engine call, turning EngineError into an HTTP 500 that carries its message."""
    try:
        return await coro
    except EngineError as exc:
        raise HTTPException(status_code=500, detail=f"{what} failed: {exc}") from exc
