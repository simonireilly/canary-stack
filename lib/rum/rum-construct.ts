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
import { Construct } from "constructs";
import { IWebVitals, WebVitals } from "./vitals-construct";
import path = require("path");

export interface RumProps {
  /**
   * Provide a domain that will be allowed to send telemetry data to the Real
   * User Monitoring agent
   */
  readonly topLevelDomain: string;
  /**
   * The name for the App Monitor that will be created
   *
   * @unique
   */
  readonly appMonitorName: string;
  /**
   * The s3 bucket that the rum script will be uploaded into after creation. This
   * should be accessible to the website, either by using the s3 origin bucket,
   * or by attaching a Cross-Origin Resource Sharing policy to the target bucket.
   */
  readonly s3Bucket: Bucket;
  /**
   * Set performance budgets for the Web Vitals generated by Real User Monitoring
   */
  readonly webVitalProps: IWebVitals;
  // Injectable identity pool for
  readonly identityPool?: CfnIdentityPool;
}

/**
 * The RUM custom resource can be used to setup Real User Monitoring using AWS
 *
 * The resource itself creates all the required infrastructure.
 *
 * A Cloudformation custom resource uploads the rum script to the s3 bucket that
 * the website is deployed to
 *
 * @example
 * const rum = new Rum(this, "SiteRum", {
 *   topLevelDomain: "*.s3-website-eu-west-1.amazonaws.com",
 *   appMonitorName: "canary-stack-rum",
 *   s3Bucket: websiteBucket,
 * });
 *
 */
export class Rum extends Construct {
  protected unauthenticatedRumRole: Role;
  readonly vitals: WebVitals;

  readonly appMonitor: CfnAppMonitor;
  readonly topLevelDomain: string;
  readonly appMonitorName: string;
  readonly s3Bucket: Bucket;
  readonly identityPool: CfnIdentityPool;

  constructor(scope: Construct, id: string, props: RumProps) {
    super(scope, id);
    this.topLevelDomain = props.topLevelDomain;
    this.appMonitorName = props.appMonitorName;
    this.s3Bucket = props.s3Bucket;

    this.identityPool = props.identityPool ?? this.createIdentityPool();
    this.appMonitor = this.initializeRum();
    this.vitals = new WebVitals(scope, `${id}-vitals`, {
      ...props.webVitalProps,
      appMonitorName: this.appMonitorName,
    });
  }

  private initializeRum() {
    this.createRumRole();
    this.createRoleAttachment();
    this.uploadRumFile();
    return this.createApplicationMonitor();
  }

  private createIdentityPool() {
    return new CfnIdentityPool(this, "RumAppIdentityPool", {
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
            new PolicyStatement({
              actions: ["xray:PutTraceSegments"],
              resources: ["*"],
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

  /**
   * Creates the app monitor required for real user monitoring
   */
  private createApplicationMonitor() {
    return new CfnAppMonitor(this, "RumAppMonitor", {
      name: this.appMonitorName,
      cwLogEnabled: true,
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

  /**
   * Places a script inside the aws s3 bucket that serves the website
   * using a custom resource
   */
  private uploadRumFile() {
    const fn = new NodejsFunction(this, "UploadRumScriptHandler", {
      handler: "handler",
      entry: path.join(__dirname, "custom", "handler", "index.ts"),
    });

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["s3:PutObject*", "s3:DeleteObject*"],
        resources: [`${this.s3Bucket.bucketArn}/rum.js`],
      })
    );

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["rum:GetAppMonitor"],
        resources: [
          Stack.of(this).formatArn({
            service: "rum",
            resource: "appmonitor",
            resourceName: this.appMonitorName,
          }),
        ],
      })
    );

    new CustomResource(this, "UploadRumScriptToWebsiteBucket", {
      serviceToken: fn.functionArn,
      properties: {
        s3BucketName: this.s3Bucket.bucketName,
        appMonitorName: this.appMonitorName,
        appMonitorConfiguration: this.appMonitor,
        // The CDK needs to always upload the rum, otherwise the new web
        // deployment erases the file.
        trigger: Date.now(),
      },
    });
  }
}
