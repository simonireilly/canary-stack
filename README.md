# Canary Stack

This stack:

- [x] Deploys a simple HTML website
- [x] Sets up and AWS canary to poll it from lambda every 5 minutes
- [x] Sets up RUM using a [rum-construct.ts](./lib/rum/rum-constrcut.ts)
- [x] Associates the RUM to the canary
- [x] Configures a cloudwatch alarm on the canary
- [x] Creates a cloudwatch dashboard showing the alarm widget

## Architecture

![diagram of architecture](./lib/website/images/diagram.png)
