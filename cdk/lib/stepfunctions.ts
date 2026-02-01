import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as cdk from "aws-cdk-lib/core";

import { Construct } from "constructs";
import { OtelEcsSampleStack } from "./otel-ecs-sample-stack";
import { OtelLambdaSampleStack } from "./otel-lambda-sample-stack";
import { OtelLambdaSampleStack2 } from "./otel-lambda-sample-stack2";
import { PowertoolsOtelLambdaSampleStack } from "./powertools-otel-lambda-sample-stack";

interface StackProps extends cdk.StackProps {
  lambdaStack1: OtelLambdaSampleStack;
  lambdaStack2: OtelLambdaSampleStack2;
  lambdaStack3: PowertoolsOtelLambdaSampleStack;
  ecsStack: OtelEcsSampleStack;
}

export class StepFunctionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Step1
    const lambdaTask1 = tasks.LambdaInvoke.jsonata(
      this,
      "Invoke OtelLambdaSampleStack Function",
      {
        lambdaFunction: props.lambdaStack1.lambdaFunction,
      },
    );

    // Step2
    const lambdaTask2 = tasks.LambdaInvoke.jsonata(
      this,
      "Invoke OtelLambdaSampleStack2 Function",
      {
        lambdaFunction: props.lambdaStack2.lambdaFunction,
      },
    );

    // Step3
    const lambdaTask3 = tasks.LambdaInvoke.jsonata(
      this,
      "Invoke PowertoolsOtelLambdaSampleStack Function",
      {
        lambdaFunction: props.lambdaStack3.lambdaFunction,
      },
    );

    // Step4
    const taskDefArn = ssm.StringParameter.valueForStringParameter(
      this,
      `/otel/${props.ecsStack.stackName}/task-definition-arn`,
    );

    // 依存関係でエラーになるためtaskDefArnはSSMParameterStoreに格納しCustomStateで定義
    const ecsTask = new sfn.CustomState(
      this,
      "Run OtelEcsSampleStack Fargate Task",
      {
        stateJson: {
          Type: "Task",
          QueryLanguage: "JSONata",
          Resource: "arn:aws:states:::ecs:runTask.sync",
          Arguments: {
            Cluster: props.ecsStack.cluster.clusterArn,
            TaskDefinition: taskDefArn,
            LaunchType: "FARGATE",
            NetworkConfiguration: {
              AwsvpcConfiguration: {
                Subnets: props.ecsStack.cluster.vpc.publicSubnets.map(
                  (s) => s.subnetId,
                ),
                SecurityGroups: [
                  props.ecsStack.ecsSecurityGroup.securityGroupId,
                ],
                AssignPublicIp: "ENABLED",
              },
            },
            Overrides: {
              ContainerOverrides: [
                {
                  Name: props.ecsStack.container.containerName,
                  Environment: [
                    {
                      Name: "X_AMZN_TRACE_ID",
                      Value: "{% $states.input.SdkHttpMetadata.HttpHeaders.`X-Amzn-Trace-Id` %}",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    );

    // Define the workflow chain
    const definition = lambdaTask1
      .next(lambdaTask2)
      .next(lambdaTask3)
      .next(ecsTask);

    // Create the state machine
    const stateMachine = new sfn.StateMachine(this, "StateMachine", {
      stateMachineName: `${cdk.Stack.of(this).stackName}-state-machine`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(60),
      tracingEnabled: true,
    });

    stateMachine.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
          "events:PutTargets",
          "events:PutRule",
          "events:DescribeRule",
        ],
        resources: ["*"],
      }),
    );

    // TaskDefinitionのロールにPassRole権限
    stateMachine.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [
          props.ecsStack.taskDefinition.executionRole?.roleArn,
          props.ecsStack.taskDefinition.taskRole?.roleArn,
        ].filter(Boolean) as string[],
      }),
    );
  }
}
