label prologue_intro:
    scene black
    centered "프롤로그\n\n오프닝 장면을 배치할 자리입니다."
    jump prologue_scene_01


label prologue_scene_01:
    $ current_arc = "prologue"
    $ current_section = "prologue_scene_01"

    centered "프롤로그 장면 1\n\n배경, 대사, 연출을 이 라벨부터 채우면 됩니다."
    jump prologue_outro


label prologue_outro:
    $ current_arc = "prologue"
    $ current_section = "prologue_outro"

    menu:
        "브리지 테스트 장면 실행":
            jump bridge_scene_test

        "1장 골격으로 이동":
            jump chapter_01_intro

        "여기서 종료":
            return


label bridge_scene_test:
    $ current_arc = "prologue"
    $ current_section = "bridge_scene_test"

    python:
        bridge_payload = bridge_generate_scene()
        bridge_choice = bridge_play_scene(bridge_payload)

    if bridge_choice:
        $ choice_summary = bridge_choice.get("summary", "선택 결과가 반영되었습니다.")
        centered "[choice_summary]"
    else:
        centered "선택지가 없어서 장면이 종료되었습니다."

    jump prologue_outro
