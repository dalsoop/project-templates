define config.name = "가야의 연결점"
define gui.show_name = True

define config.version = "0.1.0"
define build.version = "0.1.0"

define build.name = "bridge_of_gaya_renpy"

define gui.about = _("""가야의 연결점

Ren'Py 프로젝트 기본 설정 상태입니다.
시나리오, 아트, 오디오 크레딧은 추후 확정합니다.""")

define config.save_directory = "bridge_of_gaya_renpy"
define config.window_icon = "gui/window_icon.png"

define config.has_sound = True
define config.has_music = True
define config.has_voice = False

init python:
    build.classify("**~", None)
    build.classify("**.bak", None)
    build.classify("**/.**", None)
    build.classify("**/#**", None)
    build.classify("**/thumbs.db", None)
    build.classify("game/cache/**", None)
    build.classify("game/saves/**", None)
    build.classify("docs/**", None)
    build.classify("README.md", None)
    build.classify(".gitignore", None)
