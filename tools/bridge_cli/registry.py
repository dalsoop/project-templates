from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import yaml

from tools.bridge_cli.contracts import BridgeRegistry, ScenePayload


def load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"missing file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"expected mapping at root of {path}")
    return data


def load_registry(path: Path) -> BridgeRegistry:
    return BridgeRegistry.from_dict(load_yaml(path))


def load_state(path: Path) -> dict[str, Any]:
    data = load_yaml(path)
    if "state" in data and isinstance(data["state"], dict):
        return data["state"]
    return data


def validate_state(command_id: str, registry: BridgeRegistry, state: dict[str, Any]) -> None:
    spec = registry.get_command(command_id)
    missing = [field for field in spec.required_state if field not in state]
    if missing:
        joined = ", ".join(missing)
        raise ValueError(f"state for command '{command_id}' is missing required fields: {joined}")


def render_prompt(command_id: str, registry: BridgeRegistry, state: dict[str, Any]) -> tuple[str, str]:
    validate_state(command_id, registry, state)
    spec = registry.get_command(command_id)

    goals = "\n".join(f"- {goal}" for goal in spec.prompt_goals) if spec.prompt_goals else "- Keep the response coherent."
    state_json = json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True)

    system_prompt = spec.system_role.strip()
    user_prompt = (
        f"Command: {spec.id}\n"
        f"Summary: {spec.summary}\n"
        f"Output schema: {spec.output_schema}\n"
        f"Goals:\n{goals}\n\n"
        "Current state:\n"
        f"{state_json}\n\n"
        "Respond as JSON only. Do not wrap the JSON in markdown fences."
    )
    return system_prompt, user_prompt


def _extract_json_block(text: str) -> dict[str, Any]:
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("provider output did not contain a JSON object") from None
        return json.loads(stripped[start : end + 1])


def _scene_stub(command_id: str, state: dict[str, Any]) -> ScenePayload:
    day = state.get("day", "?")
    period = state.get("period", "unknown")
    location = str(state.get("location", "미정 장소"))
    money = int(state.get("money", 0))
    hunger = int(state.get("hunger", 0))
    sanity = int(state.get("sanity", 0))
    trust = int(state.get("gaya_trust", 0))
    affection = int(state.get("gaya_affection", 0))

    payload = {
        "schema_version": "scene_payload_v1",
        "title": f"{day}일차 {period}",
        "summary": "현실 파트의 생활 선택과 감정 압박을 테스트하기 위한 기본 장면입니다.",
        "location": location,
        "lines": [
            {
                "speaker_id": "system",
                "speaker_name": "시스템",
                "text": f"{location}에서 하루를 시작합니다. 현재 소지금은 {money}원입니다.",
                "mood": "neutral",
            },
            {
                "speaker_id": "narrator",
                "speaker_name": "해설",
                "text": f"배고픔은 {hunger}, 정신 안정은 {sanity}, 가야의 신뢰는 {trust}, 호감은 {affection}입니다.",
                "mood": "tense",
            },
            {
                "speaker_id": "system",
                "speaker_name": "시스템",
                "text": "이 출력은 stub provider가 만든 테스트 장면입니다. 실제 LLM 연결 시 같은 형식의 JSON이 내려와야 합니다.",
                "mood": "neutral",
            },
        ],
        "choices": [
            {
                "choice_id": "meal_with_gaya",
                "label": "가야와 식사한다",
                "summary": "돈을 조금 쓰지만 허기와 신뢰를 같이 관리할 수 있는 선택",
                "effects": {"money": -12000, "hunger": -20, "gaya_trust": 1},
            },
            {
                "choice_id": "part_time_job",
                "label": "아르바이트를 간다",
                "summary": "돈은 벌지만 체력과 감정 여유가 줄어드는 선택",
                "effects": {"money": 30000, "stamina": -15, "gaya_affection": -1},
            },
            {
                "choice_id": "dream_prep",
                "label": "밤의 꿈을 대비한다",
                "summary": "조사를 포기하고 정비에 집중하는 선택",
                "effects": {"sanity": 5, "dream_readiness": 1},
            },
        ],
        "notes": [
            "Ren'Py에서는 이 JSON을 읽어 대사창과 선택지 UI로 매핑하면 됩니다.",
            "현실 파트와 꿈 파트를 같은 출력 계약으로 맞추는 것이 핵심입니다.",
        ],
        "metadata": {
            "provider": "stub",
            "command_id": command_id,
        },
    }
    return ScenePayload.from_dict(command_id, payload)


def _scene_openai(command_id: str, registry: BridgeRegistry, state: dict[str, Any], provider: str, model: str) -> ScenePayload:
    from openai import OpenAI

    system_prompt, user_prompt = render_prompt(command_id, registry, state)
    client = OpenAI()
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
    )
    data = _extract_json_block(response.output_text)
    payload = ScenePayload.from_dict(command_id, data)
    payload.metadata.setdefault("provider", provider)
    payload.metadata.setdefault("model", model)
    return payload


def generate_scene(
    command_id: str,
    registry: BridgeRegistry,
    state: dict[str, Any],
    provider: str | None = None,
    model: str | None = None,
) -> ScenePayload:
    spec = registry.get_command(command_id)
    resolved_provider = provider or spec.provider or registry.default_provider
    resolved_model = model or spec.model or registry.default_model

    if resolved_provider == "stub":
        return _scene_stub(command_id, state)
    if resolved_provider == "openai":
        if not os.environ.get("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is required for provider=openai")
        return _scene_openai(command_id, registry, state, resolved_provider, resolved_model)
    raise ValueError(f"unsupported provider '{resolved_provider}'")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def dump_json(path: Path, data: dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

