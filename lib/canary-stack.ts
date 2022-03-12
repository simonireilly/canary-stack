import {
  Canary,
  Code,
  Runtime,
  Schedule,
  Test,
} from "@aws-cdk/aws-synthetics-alpha";
import { CfnOutput, Duration, Stack, StackProps, Tags } from "aws-cdk-lib";
import {
  Alarm,
  AlarmWidget,
  ComparisonOperator,
  Dashboard,
  PeriodOverride,
} from "aws-cdk-lib/aws-cloudwatch";
import {
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";
import { Rum } from "./rum/rum-constrcut";

export class CanaryStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Deploy the website
    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
    });

    new BucketDeployment(this, "DeployWebsite", {
      sources: [Source.asset(path.join(__dirname, "website"))],
      destinationBucket: websiteBucket,
    });

    // Setup the canary
    const canary = new Canary(this, "MyCanary", {
      schedule: Schedule.rate(Duration.minutes(5)),
      test: Test.custom({
        code: Code.fromAsset(path.join(__dirname, "canary")),
        handler: "index.handler",
      }),
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_3,
      environmentVariables: {
        SITE_URL: websiteBucket.bucketWebsiteUrl,
      },
    });

    canary.role.attachInlinePolicy(
      new Policy(this, "CanaryAllowXrayPutTrace", {
        document: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["xray:PutTraceSegments"],
              resources: ["*"],
            }),
          ],
        }),
      })
    );

    // Add Real User Monitoring
    const rum = new Rum(this, "SiteRum", {
      topLevelDomain: "*.s3-website-eu-west-1.amazonaws.com",
      appMonitorName: "canary-stack-rum",
      s3Bucket: websiteBucket,
    });

    Tags.of(canary).add(rum.appMonitor.name, "associated-rum");

    const alarm = new Alarm(this, "CanaryAlarm", {
      metric: canary.metricSuccessPercent(),
      evaluationPeriods: 2,
      threshold: 90,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
    });

    const alarmWidget = new AlarmWidget({
      alarm,
      title: "Canary Alarm",
    });

    const dashboard = new Dashboard(this, "MainDashboard", {
      dashboardName: "Rum-Dashboard",
      periodOverride: PeriodOverride.AUTO,
      widgets: [[alarmWidget]],
    });

    new CfnOutput(this, "WebsiteUrl", {
      value: websiteBucket.bucketWebsiteUrl,
    });
  }
}
