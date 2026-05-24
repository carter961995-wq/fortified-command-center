"""Gemini AI helpers for Fortified Fence and Weld business workflows.

The functions in this module use Google's ``google-genai`` SDK and expect the
API key to be available in the ``GEMINI_API_KEY`` environment variable.
"""

from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path
from typing import Any, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, Field


GEMINI_MODEL = "gemini-2.5-flash"


class ParsedFieldNotes(BaseModel):
    """Structured field notes extracted from technician notes or transcripts."""

    client_name: str = Field(description="Customer or business name tied to the job.")
    job_type: str = Field(
        description=(
            'Fence or welding job category, such as "Chain Link", '
            '"Custom Wrought Iron", "Wood Privacy", or "Gate Automation".'
        )
    )
    materials_used: list[str] = Field(
        default_factory=list,
        description="Materials, parts, or consumables mentioned in the notes.",
    )
    issues_encountered: str | None = Field(
        default=None,
        description="Problems, blockers, site conditions, or defects encountered.",
    )


class FenceMaterialEstimate(BaseModel):
    """Basic fence material and labor estimate."""

    posts_count: int = Field(ge=0, description="Estimated total posts needed.")
    top_rail_feet: int = Field(ge=0, description="Estimated top rail footage needed.")
    fabric_or_pickets_count: int = Field(
        ge=0,
        description="Estimated fabric footage or picket count, depending on style.",
    )
    hardware_kits_needed: int = Field(
        ge=0,
        description="Estimated gate/latch/hinge/hardware kits needed.",
    )
    estimated_labor_hours: float = Field(
        ge=0.0,
        description="Estimated labor hours for the described fence scope.",
    )


SchemaT = TypeVar("SchemaT", bound=BaseModel)


def _get_client(client: genai.Client | None = None) -> genai.Client:
    """Return a Gemini client configured from ``GEMINI_API_KEY``."""

    if client is not None:
        return client

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is required.")

    return genai.Client(api_key=api_key)


def _parse_structured_response(response: Any, schema: type[SchemaT]) -> SchemaT:
    """Convert a Gemini structured-output response into the requested model."""

    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if isinstance(parsed, schema):
            return parsed
        return schema.model_validate(parsed)

    text = getattr(response, "text", None)
    if not text:
        raise ValueError("Gemini response did not include structured JSON content.")

    return schema.model_validate(json.loads(text))


def parse_field_notes(
    notes: str,
    *,
    client: genai.Client | None = None,
) -> ParsedFieldNotes:
    """Convert raw technician notes or audio transcripts into structured JSON.

    Args:
        notes: Raw text notes or a transcript from a welder/fence technician.
        client: Optional preconfigured Gemini client, useful for dependency
            injection in tests or long-lived applications.

    Returns:
        ParsedFieldNotes with normalized client, job, materials, and issue data.
    """

    if not notes or not notes.strip():
        raise ValueError("notes must contain field note text to parse.")

    prompt = f"""
You are an operations assistant for Fortified Fence and Weld.

Convert the technician's raw field notes or audio transcript into the provided
JSON schema. Normalize obvious shorthand, keep the job_type concise, and only
include materials that are explicitly mentioned or clearly implied by the notes.
If no issues are mentioned, set issues_encountered to null.

Raw notes:
{notes.strip()}
""".strip()

    response = _get_client(client).models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ParsedFieldNotes,
        ),
    )
    return _parse_structured_response(response, ParsedFieldNotes)


def estimate_fence_materials(
    linear_footage: int,
    fence_height_ft: int,
    gate_count: int,
    style: str,
    *,
    client: genai.Client | None = None,
) -> FenceMaterialEstimate:
    """Estimate a basic fence bill of materials using Gemini structured output.

    Args:
        linear_footage: Total fence run length in feet.
        fence_height_ft: Fence height in feet.
        gate_count: Number of gates in the run.
        style: Fence style, such as Chain Link, Wood Privacy, Wrought Iron, or
            Gate Automation.
        client: Optional preconfigured Gemini client.

    Returns:
        FenceMaterialEstimate with count and labor estimates.
    """

    if linear_footage <= 0:
        raise ValueError("linear_footage must be greater than zero.")
    if fence_height_ft <= 0:
        raise ValueError("fence_height_ft must be greater than zero.")
    if gate_count < 0:
        raise ValueError("gate_count cannot be negative.")
    if not style or not style.strip():
        raise ValueError("style must describe the fence type.")

    prompt = f"""
You are an estimator for Fortified Fence and Weld.

Create a practical preliminary bill of materials for this fence job and return
only JSON matching the schema. Use common fence estimating assumptions:
- Space line posts no more than 8 feet apart.
- Include terminal/end posts and gate posts in posts_count.
- hardware_kits_needed should cover gate hinge/latch hardware; use at least one
  kit per gate when gates are present.
- top_rail_feet should represent top rail or equivalent horizontal rail footage.
- fabric_or_pickets_count should be chain-link/welded-wire fabric feet for fabric
  fences, or individual pickets/panels for wood, ornamental iron, or similar
  styles.
- estimated_labor_hours should reflect the complexity of the requested style,
  height, footage, and gates.

Inputs:
- linear_footage: {linear_footage}
- fence_height_ft: {fence_height_ft}
- gate_count: {gate_count}
- style: {style.strip()}
""".strip()

    response = _get_client(client).models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=FenceMaterialEstimate,
        ),
    )
    return _parse_structured_response(response, FenceMaterialEstimate)


def _image_part_from_path(image_path: str) -> types.Part:
    path = Path(image_path).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    mime_type, _ = mimetypes.guess_type(path.name)
    if mime_type is None or not mime_type.startswith("image/"):
        raise ValueError(
            f"Unable to determine a supported image MIME type for: {image_path}"
        )

    return types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type)


def analyze_jobsite_photo(
    image_path: str,
    *,
    client: genai.Client | None = None,
) -> str:
    """Analyze a fence line or broken weld photo and return markdown guidance.

    Args:
        image_path: Local path to the uploaded jobsite image.
        client: Optional preconfigured Gemini client.

    Returns:
        Plain text markdown describing visible conditions, likely materials or
        repairs needed, and suggested fix methods.
    """

    prompt = """
You are a senior fence and welding estimator for Fortified Fence and Weld.

Analyze this jobsite photo. Return concise markdown with:
1. Visual observations
2. Defects or risks spotted
3. Materials likely needed
4. Suggested repair or installation methods
5. Any assumptions or follow-up measurements needed

If the photo is unclear, say what cannot be verified from the image.
""".strip()

    response = _get_client(client).models.generate_content(
        model=GEMINI_MODEL,
        contents=[_image_part_from_path(image_path), prompt],
    )

    text = getattr(response, "text", None)
    if not text:
        raise ValueError("Gemini response did not include analysis text.")

    return text


__all__ = [
    "FenceMaterialEstimate",
    "GEMINI_MODEL",
    "ParsedFieldNotes",
    "analyze_jobsite_photo",
    "estimate_fence_materials",
    "parse_field_notes",
]
