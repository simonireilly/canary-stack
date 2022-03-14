import { Alarm, Metric } from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";

export interface IWebVitals {
  /**
   * Cumulative Layout Shift (CLS): measures visual stability. To provide a good
   * user experience, pages should maintain a CLS of 0.1. or less.
   */
  WebVitalsCumulativeLayoutShift?: number;
  /**
   * First Input Delay (FID): measures interactivity. To provide a good user
   * experience, pages should have a FID of 100 milliseconds or less.
   */
  WebVitalsFirstInputDelay?: number;
  /**
   * Largest Contentful Paint (LCP): measures loading performance. To provide a
   * good user experience, LCP should occur within 2.5 seconds of when the page
   * first starts loading.
   */
  WebVitalsLargestContentfulPaint?: number;
}

interface IWebVitalsProps extends IWebVitals {
  appMonitorName: string;
}

const DEFAULT_WEB_VITALS: Required<IWebVitals> = {
  WebVitalsCumulativeLayoutShift: 0.1,
  WebVitalsFirstInputDelay: 100,
  WebVitalsLargestContentfulPaint: 2500,
};

interface ICloudwatchWebVitalProps {
  metric: Metric;
  alarm: Alarm;
}

interface WebVitalsPerformanceVitals {
  WebVitalsCumulativeLayoutShift: ICloudwatchWebVitalProps;
  WebVitalsFirstInputDelay: ICloudwatchWebVitalProps;
  WebVitalsLargestContentfulPaint: ICloudwatchWebVitalProps;
}

/**
 * A construct enable setting performance budgets for the Web
 */
export class WebVitals extends Construct {
  private id: string;
  readonly appMonitorName: string;
  readonly WebVitalsCumulativeLayoutShift: ICloudwatchWebVitalProps;
  readonly WebVitalsFirstInputDelay: ICloudwatchWebVitalProps;
  readonly WebVitalsLargestContentfulPaint: ICloudwatchWebVitalProps;

  constructor(scope: Construct, id: string, props: IWebVitalsProps) {
    super(scope, id);
    this.id = id;
    this.appMonitorName = props.appMonitorName;

    this.WebVitalsCumulativeLayoutShift = this.configureVital(
      "WebVitalsCumulativeLayoutShift",
      props.WebVitalsCumulativeLayoutShift ||
        DEFAULT_WEB_VITALS.WebVitalsCumulativeLayoutShift
    );

    this.WebVitalsFirstInputDelay = this.configureVital(
      "WebVitalsFirstInputDelay",
      props.WebVitalsFirstInputDelay ||
        DEFAULT_WEB_VITALS.WebVitalsFirstInputDelay
    );

    this.WebVitalsLargestContentfulPaint = this.configureVital(
      "WebVitalsLargestContentfulPaint",
      props.WebVitalsLargestContentfulPaint ||
        DEFAULT_WEB_VITALS.WebVitalsLargestContentfulPaint
    );
  }

  /**
   * Web Vitals are configured to have alarms and metrics for the average real
   * user experience by default.
   */
  private configureVital(
    name: keyof WebVitalsPerformanceVitals,
    performanceBudget: number,
    statistic: "min" | "max" | "avg" | "p50" | "p90" | "p95" | "p99" = "avg"
  ): ICloudwatchWebVitalProps {
    const metric = new Metric({
      metricName: name,
      namespace: "AWS/RUM",
      dimensionsMap: {
        application_name: this.appMonitorName,
      },
      statistic,
    });

    const alarm = new Alarm(this, `${this.id}-alarm-${name}`, {
      evaluationPeriods: 2,
      threshold: performanceBudget,
      alarmName: name,
      metric,
    });

    return { metric, alarm };
  }
}
