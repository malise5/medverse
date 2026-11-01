"""Content languages: request locale and translation overlays.

English is the source language of all content. A translation is a *partial* copy of an
item's translatable fields in another language (content/i18n/<locale>/*.json, loaded
into `content_translations`). The API overlays it on the English item field by field,
so anything not yet translated stays in English, and reports how complete it is.
"""

from typing import Annotated, Any, Literal

from fastapi import Header

LOCALES = ("en", "sw")
DEFAULT_LOCALE = "en"
Locale = Literal["en", "sw"]
TranslationState = Literal["source", "complete", "partial", "missing"]

# Fields that are never translated: identifiers, links and international (Latin / TA2)
# names. Overlays keep the English value and coverage does not count them.
FIXED_FIELDS = frozenset({"latin_name", "latin", "structure_id", "system"})


def negotiate(accept_language: str | None) -> str:
    """Highest-weighted supported language of an Accept-Language header (sw-KE -> sw)."""
    if not accept_language:
        return DEFAULT_LOCALE
    ranked: list[tuple[float, str]] = []
    for part in accept_language.split(","):
        tag, *params = part.strip().split(";")
        q = 1.0
        for p in params:
            p = p.strip()
            if p.startswith("q="):
                try:
                    q = float(p[2:])
                except ValueError:
                    q = 0.0
        base = tag.strip().lower().split("-")[0]
        if base:
            ranked.append((q, base))
    for _, base in sorted(ranked, key=lambda x: -x[0]):
        if base in LOCALES:
            return base
    return DEFAULT_LOCALE


def request_locale(accept_language: Annotated[str | None, Header()] = None) -> str:
    """FastAPI dependency: the content language the client asked for."""
    return negotiate(accept_language)


def overlay(base: Any, translated: Any) -> Any:
    """Translated values replace English ones; missing ones keep English.

    Dicts merge by key; lists merge by position (a translation lists items in the same
    order as the English source); strings are replaced only by non-empty strings.
    """
    if translated is None:
        return base
    if isinstance(base, dict) and isinstance(translated, dict):
        return {
            k: v if k in FIXED_FIELDS else overlay(v, translated.get(k)) for k, v in base.items()
        }
    if isinstance(base, list) and isinstance(translated, list):
        n = len(translated)
        return [overlay(b, translated[i] if i < n else None) for i, b in enumerate(base)]
    if isinstance(base, str):
        return translated if isinstance(translated, str) and translated.strip() else base
    return base


def _strings(value: Any) -> int:
    """Number of translatable strings (non-empty) in a value."""
    if isinstance(value, dict):
        return sum(_strings(v) for k, v in value.items() if k not in FIXED_FIELDS)
    if isinstance(value, list):
        return sum(_strings(v) for v in value)
    return 1 if isinstance(value, str) and value.strip() else 0


def _translated(base: Any, translated: Any) -> int:
    if translated is None:
        return 0
    if isinstance(base, dict) and isinstance(translated, dict):
        return sum(
            _translated(v, translated.get(k)) for k, v in base.items() if k not in FIXED_FIELDS
        )
    if isinstance(base, list) and isinstance(translated, list):
        return sum(_translated(b, translated[i]) for i, b in enumerate(base) if i < len(translated))
    if isinstance(base, str) and base.strip():
        return 1 if isinstance(translated, str) and translated.strip() else 0
    return 0


def state(locale: str, base: Any, translated: Any) -> TranslationState:
    """How much of `base` the translation covers, for the requested locale."""
    if locale == DEFAULT_LOCALE:
        return "source"
    total = _strings(base)
    done = _translated(base, translated)
    if done == 0:
        return "missing"
    return "complete" if done >= total else "partial"
