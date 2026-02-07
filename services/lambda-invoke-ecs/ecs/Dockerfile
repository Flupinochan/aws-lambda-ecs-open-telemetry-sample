# syntax=docker/dockerfile:1

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ARG APP_DIR="."

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=${APP_DIR}/uv.lock,target=uv.lock \
    --mount=type=bind,source=${APP_DIR}/pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

COPY ${APP_DIR}/pyproject.toml ${APP_DIR}/uv.lock ${APP_DIR}/services/lambda-invoke-ecs/ecs/ /app/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

FROM python:3.13-slim-bookworm

RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 999 nonroot && \
    useradd --system --gid 999 --uid 999 --create-home nonroot

COPY --from=builder --chown=nonroot:nonroot /app /app


ENV PATH="/app/.venv/bin:$PATH" \
    OTEL_PYTHON_DISTRO="aws_distro" \
    OTEL_PYTHON_CONFIGURATOR="aws_configurator" \
    OTEL_AWS_EXPERIMENTAL_CODE_ATTRIBUTES=true

USER nonroot

WORKDIR /app

ENTRYPOINT ["opentelemetry-instrument", "python", "-m", "src.app"]