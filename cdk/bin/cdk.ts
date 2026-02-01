#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { OtelEcsSampleStack } from "../lib/otel-ecs-sample-stack";
import { OtelLambdaSampleStack } from "../lib/otel-lambda-sample-stack";
import { OtelLambdaSampleStack2 } from "../lib/otel-lambda-sample-stack2";
import { PowertoolsOtelLambdaSampleStack } from "../lib/powertools-otel-lambda-sample-stack";
import { StepFunctionsStack } from "../lib/stepfunctions";

const app = new cdk.App();
const lambdaStack1 = new PowertoolsOtelLambdaSampleStack(
  app,
  "PowertoolsOtelLambdaSample",
  {},
);
const lambdaStack2 = new OtelLambdaSampleStack(app, "OtelLambdaSample", {});
const lambdaStack3 = new OtelLambdaSampleStack2(app, "OtelLambdaSample2", {});
const ecsStack = new OtelEcsSampleStack(app, "OtelEcsSample", {});
new StepFunctionsStack(app, "StepFunctionsStack", {
  lambdaStack1: lambdaStack2,
  lambdaStack2: lambdaStack3,
  lambdaStack3: lambdaStack1,
  ecsStack: ecsStack,
});
