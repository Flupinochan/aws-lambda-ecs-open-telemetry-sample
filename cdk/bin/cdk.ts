#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { PowertoolsOtelLambdaSampleStack } from "../lib/powertools-otel-lambda-sample-stack";
import { OtelLambdaSampleStack } from "../lib/otel-lambda-sample-stack";
import { OtelLambdaSampleStack2 } from "../lib/otel-lambda-sample-stack2";
import { OtelEcsSampleStack } from "../lib/otel-ecs-sample-stack";

const app = new cdk.App();
new PowertoolsOtelLambdaSampleStack(app, "PowertoolsOtelLambdaSample", {});
new OtelLambdaSampleStack(app, "OtelLambdaSample", {});
new OtelLambdaSampleStack2(app, "OtelLambdaSample2", {});
new OtelEcsSampleStack(app, "OtelEcsSample", {});
