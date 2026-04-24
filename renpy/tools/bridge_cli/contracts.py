from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


def _require_non_empty(value: str, label: str) -> str:
    text = str(value).strip()
    if not text:
        raise ValueError(f"{label} must not be empty")
    return text


@dataclass(slots=True)
class CommandSpec:
    id: str
    summary: str
    output_schema: str
    system_role: str
    prompt_goals: list[str] = field(default_factory=list)
    required_state: list[str] = field(default_factory=list)
    provider: str | None = None
    model: str | None = None
    max_output_tokens: int = 1200

    @classmethod
    def from_dict(cls, command_id: str, data: dict[str, Any]) -> "CommandSpec":
        prompt_goals = [str(item).strip() for item in data.get("prompt_goals", []) if str(item).strip()]
        required_state = [str(item).strip() for item in data.get("required_state", []) if str(item).strip()]
        return cls(
            id=_require_non_empty(command_id, "command id"),
            summary=_require_non_empty(data.get("summary", ""), f"{command_id}.summary"),
            output_schema=_require_non_empty(data.get("output_schema", ""), f"{command_id}.output_schema"),
            system_role=_require_non_empty(data.get("system_role", ""), f"{command_id}.system_role"),
            prompt_goals=prompt_goals,
            required_state=required_state,
            provider=(str(data["provider"]).strip() if data.get("provider") else None),
            model=(str(data["model"]).strip() if data.get("model") else None),
            max_output_tokens=int(data.get("max_output_tokens", 1200)),
        )


@dataclass(slots=True)
class RuntimeConfig:
    output_dir: str = "runtime/output"
    prompt_dump_dir: str = "runtime/prompts"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RuntimeConfig":
        return cls(
            output_dir=str(data.get("output_dir", "runtime/output")).strip() or "runtime/output",
            prompt_dump_dir=str(data.get("prompt_dump_dir", "runtime/prompts")).strip() or "runtime/prompts",
        )


@dataclass(slots=True)
class BridgeRegistry:
    version: int
    default_provider: str
    default_model: str
    runtime: RuntimeConfig
    commands: dict[str, CommandSpec]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BridgeRegistry":
        commands_raw = data.get("commands", {})
        if not isinstance(commands_raw, dict) or not commands_raw:
            raise ValueError("registry.commands must contain at least one command")

        commands = {
            command_id: CommandSpec.from_dict(command_id, command_data)
            for command_id, command_data in commands_raw.items()
        }
        return cls(
            version=int(data.get("version", 1)),
            default_provider=_require_non_empty(data.get("default_provider", "stub"), "default_provider"),
            default_model=_require_non_empty(data.get("default_model", "gpt-4.1-mini"), "default_model"),
            runtime=RuntimeConfig.from_dict(data.get("runtime", {})),
            commands=commands,
        )

    def get_command(self, command_id: str) -> CommandSpec:
        try:
            return self.commands[command_id]
        except KeyError as exc:
            known = ", ".join(sorted(self.commands))
            raise KeyError(f"unknown command '{command_id}'. known commands: {known}") from exc


@dataclass(slots=True)
class SceneLine:
    speaker_id: str
    speaker_name: str
    text: str
    mood: str = "neutral"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SceneLine":
        return cls(
            speaker_id=_require_non_empty(data.get("speaker_id", ""), "scene line speaker_id"),
            speaker_name=_require_non_empty(data.get("speaker_name", ""), "scene line speaker_name"),
            text=_require_non_empty(data.get("text", ""), "scene line text"),
            mood=str(data.get("mood", "neutral")).strip() or "neutral",
        )


@dataclass(slots=True)
class SceneChoice:
    choice_id: str
    label: str
    summary: str
    effects: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SceneChoice":
        effects = data.get("effects", {})
        if not isinstance(effects, dict):
            raise ValueError("scene choice effects must be a mapping")
        return cls(
            choice_id=_require_non_empty(data.get("choice_id", ""), "scene choice id"),
            label=_require_non_empty(data.get("label", ""), "scene choice label"),
            summary=_require_non_empty(data.get("summary", ""), "scene choice summary"),
            effects=effects,
        )


@dataclass(slots=True)
class ScenePayload:
    command_id: str
    schema_version: str
    title: str
    summary: str
    location: str
    lines: list[SceneLine] = field(default_factory=list)
    choices: list[SceneChoice] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, command_id: str, data: dict[str, Any]) -> "ScenePayload":
        lines = [SceneLine.from_dict(item) for item in data.get("lines", [])]
        choices = [SceneChoice.from_dict(item) for item in data.get("choices", [])]
        payload = cls(
            command_id=command_id,
            schema_version=_require_non_empty(data.get("schema_version", "scene_payload_v1"), "schema_version"),
            title=_require_non_empty(data.get("title", ""), "scene title"),
            summary=_require_non_empty(data.get("summary", ""), "scene summary"),
            location=_require_non_empty(data.get("location", ""), "scene location"),
            lines=lines,
            choices=choices,
            notes=[str(item).strip() for item in data.get("notes", []) if str(item).strip()],
            metadata=data.get("metadata", {}) if isinstance(data.get("metadata", {}), dict) else {},
        )
        payload.validate()
        return payload

    def validate(self) -> None:
        if not self.lines:
            raise ValueError("scene payload must contain at least one line")
        if not self.choices:
            raise ValueError("scene payload must contain at least one choice")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

