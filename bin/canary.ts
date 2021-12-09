#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CanaryStack } from '../lib/canary-stack';

const app = new cdk.App();
new CanaryStack(app, 'CanaryStack', {});
