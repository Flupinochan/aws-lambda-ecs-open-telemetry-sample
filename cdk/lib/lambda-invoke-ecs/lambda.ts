import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import path from "path";
import { ECSStack } from "./ecs";

interface StackProps extends cdk.StackProps {
  ecsStack?: ECSStack;
}

export class LambdaStack extends cdk.Stack {
  public readonly lambdaFunction: lambda.Function;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const myRole = new iam.Role(this, "My Role", {
      roleName: `${cdk.Stack.of(this).stackName}-lambda-role`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    myRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole",
      ),
    );
    myRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
    );
    myRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonECS_FullAccess",
      ),
    );

    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "PowertoolsLayer",
      `arn:aws:lambda:${cdk.Stack.of(this).region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:15`,
    );

    const logGroup = new logs.LogGroup(this, "Log Group", {
      logGroupName: `/aws/lambda/${cdk.Stack.of(this).stackName}-function`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY,
    });

    this.lambdaFunction = new lambda.Function(this, "MyFunction", {
      functionName: `${cdk.Stack.of(this).stackName}-function`,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "app.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "services",
          "lambda-invoke-ecs",
          "lambda",
          "src",
        ),
      ),
      layers: [powertoolsLayer],
      architecture: lambda.Architecture.X86_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: myRole,
      logGroup: logGroup,
      environment: {
        TZ: "Asia/Tokyo",
        POWERTOOLS_METRICS_NAMESPACE: cdk.Stack.of(this).stackName,
        POWERTOOLS_SERVICE_NAME: `${cdk.Stack.of(this).stackName}-function`,
        POWERTOOLS_LOG_LEVEL: "INFO",
        POWERTOOLS_LOGGER_LOG_EVENT: "True",
        POWERTOOLS_TRACE_DISABLED: "True",
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: "False",
        POWERTOOLS_TRACER_CAPTURE_ERROR: "False",
        ECS_CLUSTER_NAME: props?.ecsStack?.cluster.clusterName ?? "",
        ECS_TASK_DEFINITION_ARN: props?.ecsStack?.taskDefinition.taskDefinitionArn ?? "",
        ECS_SUBNET_IDS: props?.ecsStack
          ? cdk.Fn.join(",", props.ecsStack.cluster.vpc.publicSubnets.map((s) => s.subnetId))
          : "",
        ECS_SECURITY_GROUP_IDS: props?.ecsStack
          ? cdk.Fn.join(",", [props.ecsStack.ecsSecurityGroup.securityGroupId])
          : "",
        ECS_CONTAINER_NAME: props?.ecsStack?.container.containerName ?? "",
      },
    });
  }
}
