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
  'def63f05-b1f2-4f45-8540-786fad600240',
  '1.0.0',
  'eu-west-1',
  'https://client.rum.us-east-1.amazonaws.com/1.0.5/cwr.js',
  {
    sessionSampleRate: 1,
    guestRoleArn:
      'arn:aws:iam::322567890963:role/CanaryStack-SiteRumUnauthenticatedRumRoleF61A27E4-Q1ZRCXGN1JZY',
    identityPoolId: 'eu-west-1:9936f8d3-863c-4343-9431-3af9cbc4f634',
    endpoint: 'https://dataplane.rum.eu-west-1.amazonaws.com',
    telemetries: ['errors', 'performance', 'http'],
    allowCookies: true,
    enableXRay: true,
  }
);
