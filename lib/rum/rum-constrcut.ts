import { Stack } from 'aws-cdk-lib';
import {
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
} from 'aws-cdk-lib/aws-cognito';
import {
  FederatedPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import { CfnAppMonitor } from 'aws-cdk-lib/aws-rum';
import { Construct } from 'constructs';

export interface RumProps {
  topLevelDomain: string;
  appMonitorName: string;
  stack: Stack;
}

export class Rum extends Construct {
  private stack: Stack;
  protected identityPool: CfnIdentityPool;
  protected unauthenticatedRumRole: Role;
  readonly appMonitor: CfnAppMonitor;
  readonly topLevelDomain: string;
  readonly appMonitorName: string;

  constructor(scope: Construct, id: string, props: RumProps) {
    super(scope, id);
    this.topLevelDomain = props.topLevelDomain;
    this.appMonitorName = props.appMonitorName;
    this.stack = props.stack;

    this.appMonitor = this.initializeRum();
  }

  private initializeRum() {
    this.createIdentityPool();
    this.createRumRole();
    this.createRoleAttachment();
    return this.createApplicationMonitor();
  }

  private createIdentityPool() {
    this.identityPool = new CfnIdentityPool(this, 'RumAppIdentityPool', {
      allowUnauthenticatedIdentities: true,
    });
  }

  private createRumRole() {
    this.unauthenticatedRumRole = new Role(this, 'UnauthenticatedRumRole', {
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        RUMPutBatchMetrics: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['rum:PutRumEvents'],
              resources: [
                this.stack.formatArn({
                  service: 'rum',
                  resource: 'appmonitor',
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
    new CfnIdentityPoolRoleAttachment(this, 'RumAppRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        unauthenticated: this.unauthenticatedRumRole.roleArn,
      },
    });
  }

  private createApplicationMonitor() {
    return new CfnAppMonitor(this, 'RumAppMonitor', {
      name: this.appMonitorName,
      cwLogEnabled: false,
      domain: this.topLevelDomain,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        sessionSampleRate: 1,
        telemetries: ['errors', 'performance', 'http'],
        identityPoolId: this.identityPool.ref,
        guestRoleArn: this.unauthenticatedRumRole.roleArn,
      },
    });
  }
}
