"""サンプル

Logger: Powertools
Tracer: OpenTelemetry
"""

import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.logging.formatter import LambdaPowertoolsFormatter

# logger
formatter = LambdaPowertoolsFormatter(
    log_record_order=["message", "level", "timestamp", "location"],
)
logger = Logger(logger_formatter=formatter)

# tracer
tracer = Tracer()

# boto3 client
ecs_client = boto3.client("ecs")

# environment variables

ECS_CLUSTER_NAME = os.environ.get("ECS_CLUSTER_NAME", "")
ECS_TASK_DEFINITION_ARN = os.environ.get("ECS_TASK_DEFINITION_ARN", "")
ECS_SUBNET_IDS = os.environ.get("ECS_SUBNET_IDS", "")
ECS_SECURITY_GROUP_IDS = os.environ.get("ECS_SECURITY_GROUP_IDS", "")
ECS_CONTAINER_NAME = os.environ.get("ECS_CONTAINER_NAME", "")


def lambda_handler(_event: object, _context: object) -> None:
    """Lambda handler."""
    # コールドスタート影響のため、lambda_handler内で取得
    x_amzn_trace_id = os.environ.get("_X_AMZN_TRACE_ID", "")
    logger.info("X-Amzn-Trace-Id: %s", x_amzn_trace_id)

    ecs_client.run_task(
        launchType="FARGATE",
        cluster=ECS_CLUSTER_NAME,
        taskDefinition=ECS_TASK_DEFINITION_ARN,
        platformVersion="LATEST",
        networkConfiguration={
            "awsvpcConfiguration": {
                "subnets": ECS_SUBNET_IDS.split(","),
                "securityGroups": ECS_SECURITY_GROUP_IDS.split(","),
                "assignPublicIp": "ENABLED",
            },
        },
        overrides={
            "containerOverrides": [
                {
                    "name": ECS_CONTAINER_NAME,
                    "environment": [
                        {
                            "name": "X_AMZN_TRACE_ID",
                            "value": x_amzn_trace_id,
                        },
                    ],
                },
            ],
        },
    )
