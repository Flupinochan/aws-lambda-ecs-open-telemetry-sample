#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { OtelEcsSampleStack } from "../lib/otel-ecs-sample-stack";
import { OtelLambdaSampleStack } from "../lib/otel-lambda-sample-stack";
import { OtelLambdaSampleStack2 } from "../lib/otel-lambda-sample-stack2";
import { PowertoolsOtelLambdaSampleStack } from "../lib/powertools-otel-lambda-sample-stack";
import { StepFunctionsStack } from "../lib/stepfunctions";
import { LambdaStack } from "../lib/lambda-invoke-ecs/lambda";
import { ECSStack } from "../lib/lambda-invoke-ecs/ecs";

// Step FunctionsからLambda, ECSを呼び出す構成
// const app = new cdk.App();
// const lambdaStack1 = new PowertoolsOtelLambdaSampleStack(
//   app,
//   "PowertoolsOtelLambdaSample",
//   {},
// );
// const lambdaStack2 = new OtelLambdaSampleStack(app, "OtelLambdaSample", {});
// const lambdaStack3 = new OtelLambdaSampleStack2(app, "OtelLambdaSample2", {});
// const ecsStack = new OtelEcsSampleStack(app, "OtelEcsSample", {});
// new StepFunctionsStack(app, "StepFunctionsStack", {
//   lambdaStack1: lambdaStack2,
//   lambdaStack2: lambdaStack3,
//   lambdaStack3: lambdaStack1,
//   ecsStack: ecsStack,
// });

// LambdaからECSを呼び出す構成
const app2 = new cdk.App();
const ecsStack = new ECSStack(app2, "EcsStack");
new LambdaStack(app2, "LambdaInvokeEcsStack", {
	ecsStack: ecsStack,
});