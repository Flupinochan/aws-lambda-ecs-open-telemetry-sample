"""サンプル

Logger & Tracer: OpenTelemetry
"""

import json
import logging
import time

from opentelemetry import trace

# logger
logger = logging.getLogger("sample-logger")

# tracer
tracer = trace.get_tracer("sample-tracer")


@tracer.start_as_current_span("step1")
def step1() -> dict[str, object]:
    """Step 1: Simulate I/O-like work."""
    time.sleep(0.25)
    logger.info("step1 called")
    return {"value": 123}


@tracer.start_as_current_span("step2")
def step2() -> dict[str, object]:
    """Step 2: Simulate CPU-like work."""
    data = step1()
    time.sleep(0.15)
    logger.info("step2 called")
    return {"value": data.get("value"), "transformed": True}


@tracer.start_as_current_span("step3")
def step3() -> None:
    """Step 3: Simulate a downstream call."""
    time.sleep(0.35)
    logger.info("step3 called")


@tracer.start_as_current_span("do_work")
def run_pipeline() -> None:
    """Run the step pipeline with nested calls."""
    step2()
    step3()


def lambda_handler(_event: object, _context: object) -> dict[str, object]:
    """Lambda handler."""
    run_pipeline()
    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": "pipeline complete",
            },
        ),
    }
