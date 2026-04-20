init python:
    import json
    import os
    import subprocess

    _bridge_character_cache = {}


    def bridge_get_character(name):
        if not name:
            return None
        if name not in _bridge_character_cache:
            _bridge_character_cache[name] = renpy.character.Character(name)
        return _bridge_character_cache[name]


    def bridge_build_state():
        store = renpy.store
        return {
            "day": store.day,
            "period": store.period,
            "location": store.location,
            "money": store.money,
            "hunger": store.hunger,
            "stamina": store.stamina,
            "sanity": store.sanity,
            "gaya_affection": store.gaya_affection,
            "gaya_trust": store.gaya_trust,
            "gaya_dependency": store.gaya_dependency,
            "dream_readiness": store.dream_readiness,
            "discovered_clues": list(store.discovered_clues),
            "active_flags": list(store.active_flags),
        }


    def bridge_generate_scene(command_id="generate_scene", provider=None):
        base_dir = renpy.config.basedir
        runtime_dir = os.path.join(base_dir, "runtime")
        output_dir = os.path.join(runtime_dir, "output")
        os.makedirs(output_dir, exist_ok=True)

        state_path = os.path.join(output_dir, "state.current.json")
        scene_path = os.path.join(output_dir, "scene_payload.json")
        script_path = os.path.join(base_dir, "scripts", "bridge")

        state_payload = {"state": bridge_build_state()}
        with open(state_path, "w", encoding="utf-8") as handle:
            json.dump(state_payload, handle, ensure_ascii=False, indent=2)

        command = [
            script_path,
            "generate-scene",
            "--command-id",
            command_id,
            "--state",
            state_path,
            "--output",
            scene_path,
        ]
        resolved_provider = provider or renpy.store.bridge_provider
        if resolved_provider:
            command.extend(["--provider", resolved_provider])

        result = subprocess.run(
            command,
            cwd=base_dir,
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            message = (result.stderr or result.stdout or "bridge command failed").strip()
            renpy.store.bridge_last_error = message
            raise Exception(message)

        with open(scene_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)

        renpy.store.bridge_last_error = ""
        return payload


    def bridge_apply_effects(choice):
        effects = choice.get("effects", {})
        store = renpy.store

        for key, delta in effects.items():
            if hasattr(store, key) and isinstance(getattr(store, key), int) and isinstance(delta, int):
                setattr(store, key, getattr(store, key) + delta)


    def bridge_play_scene(payload):
        title = payload.get("title", "장면")
        summary = payload.get("summary", "")
        if summary:
            renpy.say(None, f"{title}\n{summary}")
        else:
            renpy.say(None, title)

        for line in payload.get("lines", []):
            speaker_name = line.get("speaker_name", "")
            text = line.get("text", "")
            who = bridge_get_character(speaker_name)
            renpy.say(who, text)

        choices = payload.get("choices", [])
        if not choices:
            renpy.store.bridge_last_choice_id = ""
            return None

        menu_items = [(choice.get("label", "선택"), choice.get("choice_id", "")) for choice in choices]
        selected_id = renpy.display_menu(menu_items)
        renpy.store.bridge_last_choice_id = selected_id or ""

        for choice in choices:
            if choice.get("choice_id") == selected_id:
                bridge_apply_effects(choice)
                return choice

        return None
