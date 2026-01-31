import datetime
import json
import logging
import sys
import time
from collections.abc import Sequence
from os import linesep

from opentelemetry import propagate, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk._logs import (
    LoggerProvider,
    LoggingHandler,
    ReadableLogRecord,
)
from opentelemetry.sdk._logs.export import (  # ConsoleLogExporter on versions earlier than 1.39.0
    BatchLogRecordProcessor,
    LogRecordExporter,
    LogRecordExportResult,
)
from opentelemetry.sdk.extension.aws.resource.ecs import (
    AwsEcsResourceDetector,
)
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.sdk.resources import Resource, get_aggregated_resources
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
)

# tracer
ecs_resource = get_aggregated_resources([AwsEcsResourceDetector()])
service_resource = Resource.create(
    {
        "service.name": "ecs-sample-service",
        "service.namespace": "sample-namespace",
    },
)
merged_resource = ecs_resource.merge(service_resource)
provider = TracerProvider(
    id_generator=AwsXRayIdGenerator(),
    resource=merged_resource,
)
## 出力先は以下のOTEL configファイルを参照 (デフォルトはlocalhost:4318)
## config/ecs/ecs-default-config.yaml
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
span_processor = BatchSpanProcessor(otlp_exporter)
provider.add_span_processor(span_processor)
trace.set_tracer_provider(provider)
propagate.set_global_textmap(AwsXRayPropagator())
tracer = trace.get_tracer("my.tracer.name")


# logger
class CustomLogRecordExporter(LogRecordExporter):
    """カスタムのログ出力設定"""

    def __init__(self):
        self.out = sys.stdout

        def formatter(record: ReadableLogRecord) -> str:
            rr = record.log_record

            # JST変換
            timestamp = rr.timestamp
            if rr.timestamp is not None:
                ts = datetime.datetime.fromtimestamp(
                    rr.timestamp / 1e9,
                    tz=datetime.UTC,
                )
                jst = datetime.timezone(datetime.timedelta(hours=9))
                timestamp = ts.astimezone(jst).isoformat(timespec="microseconds")

            # 出力するLogRecordの内容を定義
            obj = {
                "message": rr.body,
                "level": rr.severity_text,
                "timestamp": timestamp,
                "attributes": dict(rr.attributes) if bool(rr.attributes) else None,
                "trace_id": (
                    f"{format(rr.trace_id, '032x')}" if rr.trace_id is not None else ""
                ),
            }
            # Noneで改行をなくしてJSON出力
            return json.dumps(obj, indent=None) + linesep

        self.formatter = formatter

    def export(self, batch: Sequence[ReadableLogRecord]):
        for log_record in batch:
            self.out.write(self.formatter(log_record))
        self.out.flush()
        return LogRecordExportResult.SUCCESS

    def shutdown(self):
        pass


provider = LoggerProvider(resource=service_resource)
# 標準のログFormatであるConsoleLogRecordExporterを利用することも可能
processor = BatchLogRecordProcessor(CustomLogRecordExporter())
provider.add_log_record_processor(processor)
set_logger_provider(provider)
handler = LoggingHandler(level=logging.INFO, logger_provider=provider)
# bodyキーに出力される内容をmessageのみにする
# OpenTelemetryのloggerにはTracesとMetricsとは異なり、
# Logs API(.infoや.error)がないため普通にloggingの仕組みを使う
handler.setFormatter(logging.Formatter("%(message)s"))
logging.basicConfig(handlers=[handler], level=logging.INFO)
logger = logging.getLogger("my.logger.name")


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


@tracer.start_as_current_span("main")
def main():
    """Main function."""
    trace_id = trace.get_current_span().get_span_context().trace_id
    # X-Rayでtrace idで検索する際は接頭辞の0xは不要
    logger.info(f"Trace ID: {trace_id:032x}")
    run_pipeline()


if __name__ == "__main__":
    main()
