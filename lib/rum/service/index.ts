import { RUM } from 'aws-sdk';

const rum = new RUM({});

const rumFileService = async (name: string): Promise<string> => {
  const appMonitor = await rum
    .getAppMonitor({
      Name: name,
    })
    .promise();

  if (appMonitor.AppMonitor) {
    const fileString = RUM_TEMPLATE(appMonitor.AppMonitor);

    return fileString;
  }

  return '';
};

/**
 * TODO: Improve the template to perform camel casing of
 * RUM.AppMonitor.AppMonitorConfiguration so that all configuration is supported
 */
const RUM_TEMPLATE = (rum: RUM.AppMonitor) => `
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
  'https://client.rum.us-east-1.amazonaws.com/1.0.5/cwr.js',
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

rumFileService('canary-stack-monitor');
