import { RUM } from "aws-sdk";

export interface CustomProperties {
  appMonitorName: string;
  s3BucketName: string;
  ServiceToken: string;
}

const rum = new RUM({});

export const customPropertiesTypeGuard = (
  props: unknown
): props is CustomProperties => {
  if (Array.isArray(props)) {
    return false;
  }

  if (typeof props !== "object") {
    return false;
  }

  const typeCastProps = props as CustomProperties;

  if (typeof typeCastProps.appMonitorName !== "string") {
    return false;
  }

  if (typeof typeCastProps.s3BucketName !== "string") {
    return false;
  }

  return true;
};

export const rumFileService = async (
  appMonitorName: string
): Promise<string> => {
  const appMonitor = await rum
    .getAppMonitor({
      Name: appMonitorName,
    })
    .promise();

  if (appMonitor.AppMonitor) {
    const fileString = RUM_TEMPLATE(appMonitor.AppMonitor);

    return fileString;
  }

  return "";
};

const RUM_TEMPLATE = (rum: RUM.AppMonitor): string => `
(function (n, i, v, r, s, c, x, z) {
  x = window.AwsRumClient = { q: [], n: n, i: i, v: v, r: r, c: c };
  window[n] = function (c, p) {
    x.q.push({ c: c, p: p });
  };
  z = document.createElement('script');
  z.async = true;
  z.src = s;
  document.head.insertBefore(
    z,
    document.head.getElementsByTagName('script')[0]
  );
})(
  'cwr',
  '${rum.Id}',
  '1.0.0',
  'eu-west-1',
  'https://client.rum.us-east-1.amazonaws.com/1.2.1/cwr.js',
  {
    sessionSampleRate: ${rum.AppMonitorConfiguration?.SessionSampleRate},
    guestRoleArn:
      '${rum.AppMonitorConfiguration?.GuestRoleArn}',
    identityPoolId: '${rum.AppMonitorConfiguration?.IdentityPoolId}',
    endpoint: 'https://dataplane.rum.eu-west-1.amazonaws.com',
    telemetries: [${
      '"' + rum.AppMonitorConfiguration?.Telemetries?.join('","') + '"'
    }],
    allowCookies: ${rum.AppMonitorConfiguration?.AllowCookies},
    enableXRay: ${rum.AppMonitorConfiguration?.EnableXRay},
  }
);
`;
