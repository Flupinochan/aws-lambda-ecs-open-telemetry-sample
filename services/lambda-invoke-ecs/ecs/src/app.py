import os

import boto3
from opentelemetry import context, trace
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.botocore import BotocoreInstrumentor
from opentelemetry.propagators.aws import AwsXRayPropagator
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
X_AMZN_TRACE_ID = os.environ.get("X_AMZN_TRACE_ID", "")
headers = {"X-Amzn-Trace-Id": X_AMZN_TRACE_ID} if X_AMZN_TRACE_ID else {}
ctx = AwsXRayPropagator().extract(carrier=headers)
ctx2 = W3CBaggagePropagator().extract(carrier=headers, context=ctx)
context.attach(ctx2)

ecs_resource = get_aggregated_resources([AwsEcsResourceDetector()])
service_resource = Resource.create(
    {
        "service.name": "ecs-sample-service",
        "service.namespace": "sample-namespace",
    },
)
merged_resource = ecs_resource.merge(service_resource)
trace_provider = TracerProvider(
    id_generator=AwsXRayIdGenerator(),
    resource=merged_resource,
)
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
span_processor = BatchSpanProcessor(otlp_exporter)
trace_provider.add_span_processor(span_processor)
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer("my.tracer.name")

# 以下追加で自動トレースしたいライブラリを追加することも可能
BotocoreInstrumentor().instrument()
# HTTPXClientInstrumentor().instrument()
# SQLAlchemyInstrumentor().instrument()


@tracer.start_as_current_span("step1")
def step1() -> None:
    print("Step 1")


@tracer.start_as_current_span("step2")
def step2() -> None:
    step1()
    print("Step 2")


@tracer.start_as_current_span("step3")
def step3() -> None:
    print("Step 3")


@tracer.start_as_current_span("main", context=ctx2, kind=trace.SpanKind.CONSUMER)
def main() -> None:
    step2()
    step3()


if __name__ == "__main__":
    main()
    log_client = boto3.client("logs")

    paginator = log_client.get_paginator("describe_log_groups")
    for page in paginator.paginate():
        for g in page.get("logGroups", []):
            print(g["logGroupName"])
