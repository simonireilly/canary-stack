import { CustomResource, Stack } from "aws-cdk-lib";
import {
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
} from "aws-cdk-lib/aws-cognito";
import {
  FederatedPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { CfnAppMonitor } from "aws-cdk-lib/aws-rum";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { AwsCustomResource } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import path = require("path");

export interface RumProps {
  topLevelDomain: string;
  appMonitorName: string;
  s3Bucket: Bucket;
}

/**
 * The RUM custom resource can be used to setup Real User Monitoring using AWS
 *
 * The resource itself creates all the required
 */
export class Rum extends Construct {
  protected identityPool: CfnIdentityPool;
  protected unauthenticatedRumRole: Role;
  readonly appMonitor: CfnAppMonitor;
  readonly topLevelDomain: string;
  readonly appMonitorName: string;
  readonly s3Bucket: Bucket;

  constructor(scope: Construct, id: string, props: RumProps) {
    super(scope, id);
    this.topLevelDomain = props.topLevelDomain;
    this.appMonitorName = props.appMonitorName;
    this.s3Bucket = props.s3Bucket;

    this.appMonitor = this.initializeRum();
  }

  private initializeRum() {
    this.createIdentityPool();
    this.createRumRole();
    this.createRoleAttachment();
    this.uploadRumFile();
    return this.createApplicationMonitor();
  }

  private createIdentityPool() {
    this.identityPool = new CfnIdentityPool(this, "RumAppIdentityPool", {
      allowUnauthenticatedIdentities: true,
    });
  }

  private createRumRole() {
    this.unauthenticatedRumRole = new Role(this, "UnauthenticatedRumRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      inlinePolicies: {
        RUMPutBatchMetrics: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["rum:PutRumEvents"],
              resources: [
                Stack.of(this).formatArn({
                  service: "rum",
                  resource: "appmonitor",
                  resourceName: this.appMonitorName,
                }),
              ],
            }),
          ],
        }),
      },
    });
  }

  private createRoleAttachment() {
    new CfnIdentityPoolRoleAttachment(this, "RumAppRoleAttachment", {
      identityPoolId: this.identityPool.ref,
      roles: {
        unauthenticated: this.unauthenticatedRumRole.roleArn,
      },
    });
  }

  private createApplicationMonitor() {
    return new CfnAppMonitor(this, "RumAppMonitor", {
      name: this.appMonitorName,
      cwLogEnabled: false,
      domain: this.topLevelDomain,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        sessionSampleRate: 1,
        telemetries: ["errors", "performance", "http"],
        identityPoolId: this.identityPool.ref,
        guestRoleArn: this.unauthenticatedRumRole.roleArn,
      },
    });
  }

  private uploadRumFile() {
    const fn = new NodejsFunction(this, "OnEventHandler", {
      handler: "handler",
      entry: path.join(__dirname, "custom", "handler", "index.ts"),
    });

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [this.s3Bucket.bucketArn],
      })
    );

    new CustomResource(this, "UploadRumScriptToWebsiteBucket", {
      serviceToken: fn.functionArn,
      properties: {
        s3BucketName: this.s3Bucket.bucketName,
        appMonitorName: this.appMonitorName,
        appMonitorConfiguration: this.appMonitor,
      },
    });
  }
}
