from __future__ import annotations

import json
import platform
from pathlib import Path

from jsonargparse import ActionConfigFile, ArgumentParser

from tools.bridge_cli.registry import dump_json, generate_scene, load_registry, load_state, render_prompt


DEFAULT_REGISTRY = Path("config/bridge/registry.yaml")
DEFAULT_STATE = Path("config/bridge/state.example.yaml")


def _build_parser() -> ArgumentParser:
    parser = ArgumentParser(prog="gaya-bridge", default_env=True, description="Command-driven bridge for Ren'Py and LLM tooling.")
    subcommands = parser.add_subcommands(dest="command")

    doctor = ArgumentParser(default_env=True, description="Print local bridge environment status.")
    doctor.add_argument("--config", action=ActionConfigFile)
    subcommands.add_subcommand("doctor", doctor)

    validate = ArgumentParser(default_env=True, description="Validate registry and state files.")
    validate.add_argument("--config", action=ActionConfigFile)
    validate.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    validate.add_argument("--state", type=Path, default=DEFAULT_STATE)
    validate.add_argument("--command-id", default="generate_scene")
    subcommands.add_subcommand("validate-config", validate)

    render = ArgumentParser(default_env=True, description="Render the final system/user prompt pair.")
    render.add_argument("--config", action=ActionConfigFile)
    render.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    render.add_argument("--state", type=Path, default=DEFAULT_STATE)
    render.add_argument("--command-id", default="generate_scene")
    render.add_argument("--output", type=Path, default=Path("runtime/prompts/rendered_prompt.txt"))
    subcommands.add_subcommand("render-prompt", render)

    generate = ArgumentParser(default_env=True, description="Generate a scene payload from state + registry.")
    generate.add_argument("--config", action=ActionConfigFile)
    generate.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    generate.add_argument("--state", type=Path, default=DEFAULT_STATE)
    generate.add_argument("--command-id", default="generate_scene")
    generate.add_argument("--provider", default=None)
    generate.add_argument("--model", default=None)
    generate.add_argument("--output", type=Path, default=Path("runtime/output/scene_payload.json"))
    generate.add_argument("--stdout", action="store_true", help="Print the generated JSON to stdout as well.")
    subcommands.add_subcommand("generate-scene", generate)

    return parser


def _cmd_doctor() -> int:
    registry_exists = DEFAULT_REGISTRY.exists()
    state_exists = DEFAULT_STATE.exists()
    openai_key = "present" if __import__("os").environ.get("OPENAI_API_KEY") else "missing"

    print("gaya-bridge doctor")
    print(f"python_version: {platform.python_version()}")
    print(f"platform: {platform.platform()}")
    print(f"registry: {'ok' if registry_exists else 'missing'} ({DEFAULT_REGISTRY})")
    print(f"state: {'ok' if state_exists else 'missing'} ({DEFAULT_STATE})")
    print(f"openai_api_key: {openai_key}")
    return 0


def _cmd_validate_config(args) -> int:
    registry = load_registry(args.registry)
    state = load_state(args.state)
    render_prompt(args.command_id, registry, state)
    print(f"validated command '{args.command_id}' against {args.registry} and {args.state}")
    return 0


def _cmd_render_prompt(args) -> int:
    registry = load_registry(args.registry)
    state = load_state(args.state)
    system_prompt, user_prompt = render_prompt(args.command_id, registry, state)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "=== SYSTEM ===\n"
        f"{system_prompt}\n\n"
        "=== USER ===\n"
        f"{user_prompt}\n",
        encoding="utf-8",
    )
    print(f"prompt written to {args.output}")
    return 0


def _cmd_generate_scene(args) -> int:
    registry = load_registry(args.registry)
    state = load_state(args.state)
    payload = generate_scene(
        command_id=args.command_id,
        registry=registry,
        state=state,
        provider=args.provider,
        model=args.model,
    )
    dump_json(args.output, payload.to_dict())
    print(f"scene payload written to {args.output}")
    if args.stdout:
        print(json.dumps(payload.to_dict(), ensure_ascii=False, indent=2))
    return 0


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    command = getattr(args, "command", None)
    if not command:
        parser.print_help()
        raise SystemExit(1)
    subargs = getattr(args, command, args)

    if command == "doctor":
        raise SystemExit(_cmd_doctor())
    if command == "validate-config":
        raise SystemExit(_cmd_validate_config(subargs))
    if command == "render-prompt":
        raise SystemExit(_cmd_render_prompt(subargs))
    if command == "generate-scene":
        raise SystemExit(_cmd_generate_scene(subargs))

    raise SystemExit(f"unknown command: {command}")
