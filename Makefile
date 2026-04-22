PROJECT_NAME := infocutter

.PHONY: help bootstrap doctor build dev watch rebuild package rc reset clean clean-all check lint typecheck test

help:
	@printf "%s\n" \
	"Available commands:" \
	"  make bootstrap  - install dependencies" \
	"  make doctor     - verify environment and build inputs" \
	"  make build      - build unpacked extension into dist/" \
	"  make dev        - build once and print load instructions" \
	"  make watch      - rebuild automatically on file changes" \
	"  make rebuild    - clean rebuild and doctor check" \
	"  make check      - lint + typecheck + test" \
	"  make package    - create dist-package zip" \
	"  make rc         - rebuild + check + package" \
	"  make reset      - remove build artifacts"

bootstrap:
	npm run bootstrap

doctor:
	npm run doctor

build:
	npm run build

dev:
	npm run dev

watch:
	npm run watch

rebuild:
	npm run rebuild

package:
	npm run package

rc:
	npm run rc

reset:
	npm run reset

clean:
	npm run clean

clean-all:
	npm run clean:all

check:
	npm run check

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test
