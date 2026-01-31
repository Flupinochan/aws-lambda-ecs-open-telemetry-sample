import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import path from "path";

export class OtelEcsSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "SampleVpc", {
      maxAzs: 2,
    });

    // ECSタスク用セキュリティグループ
    const ecsSecurityGroup = new ec2.SecurityGroup(
      this,
      "EcsTaskSecurityGroup",
      {
        vpc,
        description: "Allow all outbound traffic for ECS tasks",
        allowAllOutbound: true,
      },
    );

    // ECS Cluster
    const cluster = new ecs.Cluster(this, "SampleCluster", {
      vpc,
    });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccessV2"),
    );
    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
    );

    // 既存の実行ロールを利用
    const executionRole = iam.Role.fromRoleArn(
      this,
      "ExecRole",
      `arn:aws:iam::${cdk.Stack.of(this).account}:role/ecsTaskExecutionRole`,
    );

    // CloudWatch LogGroup（Collector用）
    const collectorLogGroup = new logs.LogGroup(this, "CollectorLogGroup", {
      logGroupName: "/ecs/ecs-aws-otel-sidecar-collector",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY,
    });
    // CloudWatch LogGroup（Emitter用）
    const emitterLogGroup = new logs.LogGroup(this, "EmitterLogGroup", {
      logGroupName: "/ecs/aws-otel-emitter",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY,
    });

    // Fargate Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, "OtelTaskDef", {
      cpu: 1024,
      memoryLimitMiB: 3072,
      taskRole,
      executionRole,
    });

    // aws-otel-collector コンテナ
    const collectorContainer = taskDef.addContainer("aws-otel-collector", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/aws-observability/aws-otel-collector:latest",
      ),
      essential: true,
      command: ["--config=/etc/ecs/ecs-default-config.yaml"],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ecs",
        logGroup: collectorLogGroup,
      }),
    });

    // アプリケーションコンテナ
    const emitterContainer = taskDef.addContainer("app", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "..", ".."), {
        file: "services/ecs/Dockerfile",
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ecs",
        logGroup: emitterLogGroup,
      }),
    });
    emitterContainer.addContainerDependencies({
      container: collectorContainer,
      condition: ecs.ContainerDependencyCondition.START,
    });
  }
}
