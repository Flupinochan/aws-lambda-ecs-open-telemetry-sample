import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import path from "path";

export class OtelLambdaSampleStack extends cdk.Stack {
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

    const fn = new lambda.Function(this, "MyFunction", {
      functionName: `${cdk.Stack.of(this).stackName}-function`,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: "app.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "..", "services", "otel-lambda", "src"),
      ),
      adotInstrumentation: {
        layerVersion: lambda.AdotLayerVersion.fromPythonSdkLayerVersion(
          lambda.AdotLambdaLayerPythonSdkVersion.LATEST,
        ),
        execWrapper: lambda.AdotLambdaExecWrapper.INSTRUMENT_HANDLER,
      },
      architecture: lambda.Architecture.X86_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      loggingFormat: lambda.LoggingFormat.JSON,
      role: myRole,
      logGroup: logGroup,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
      },
    });
  }
}
