import * as cdk from '@aws-cdk/core';
import { Canary, Code, Runtime, Schedule, Test } from '@aws-cdk/aws-synthetics';
import { CfnOutput, Duration } from '@aws-cdk/core';
import * as path from 'path';
import {
  Alarm,
  AlarmWidget,
  ComparisonOperator,
  Dashboard,
  PeriodOverride,
} from '@aws-cdk/aws-cloudwatch';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';

export class CanaryStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const websiteBucket = new Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
    });

    new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset(path.join(__dirname, 'website'))],
      destinationBucket: websiteBucket,
    });

    const canary = new Canary(this, 'MyCanary', {
      schedule: Schedule.rate(Duration.minutes(5)),
      test: Test.custom({
        code: Code.fromAsset(path.join(__dirname, 'canary')),
        handler: 'index.handler',
      }),
      runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_3,
      environmentVariables: {
        SITE_URL: websiteBucket.bucketWebsiteUrl,
      },
    });

    const alarm = new Alarm(this, 'CanaryAlarm', {
      metric: canary.metricSuccessPercent(),
      evaluationPeriods: 2,
      threshold: 90,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
    });

    const alarmWidget = new AlarmWidget({
      alarm,
      title: 'Canary Alarm',
    });

    const dashboard = new Dashboard(this, 'MainDashbaord', {
      dashboardName: 'Main-Dashboard',
      periodOverride: PeriodOverride.AUTO,
      widgets: [[alarmWidget]],
    });

    new CfnOutput(this, 'WebsiteUrl', {
      value: websiteBucket.bucketWebsiteUrl,
    });
  }
}
