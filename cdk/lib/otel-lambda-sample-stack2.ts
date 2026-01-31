import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import path from "path";

export class OtelLambdaSampleStack2 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
        "CloudWatchLambdaApplicationSignalsExecutionRolePolicy",
      ),
    );

    const logGroup = new logs.LogGroup(this, "Log Group", {
      logGroupName: `/aws/lambda/${cdk.Stack.of(this).stackName}-function`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY,
    });

    const adotDistroLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "AdotDistroLayer",
      `arn:aws:lambda:${cdk.Stack.of(this).region}:615299751070:layer:AWSOpenTelemetryDistroPython:20`,
    );

    const fn = new lambda.Function(this, "MyFunction", {
      functionName: `${cdk.Stack.of(this).stackName}-function`,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "app.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "..", "services", "otel-lambda", "src"),
      ),
      layers: [adotDistroLayer],
      architecture: lambda.Architecture.X86_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: myRole,
      logGroup: logGroup,
      environment: {
        // https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
        OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED: "true",
        OTEL_PROPAGATORS: "xray",
        OTEL_LOGS_EXPORTER: "console",
        OTEL_METRICS_EXPORTER: "awsemf",
      },
    });
  }
}
