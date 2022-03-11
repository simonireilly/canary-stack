import { CloudFormationCustomResourceHandler } from "aws-lambda";
import { S3 } from "aws-sdk";
import { sendFailureMessage, sendSuccessMessage } from "../aws";
import {
  CustomProperties,
  customPropertiesTypeGuard,
  rumFileService,
} from "./api";

const s3 = new S3({});

export const handler: CloudFormationCustomResourceHandler = async (
  event,
  context
) => {
  console.info("Received request to update the RUM tempalte", {
    props: event.ResourceProperties,
    requestType: event.RequestType,
  });

  if (!customPropertiesTypeGuard(event.ResourceProperties)) {
    await sendFailureMessage(event);
    return;
  }

  try {
    switch (event.RequestType) {
      case "Create":
        await upsert(event.ResourceProperties);
      case "Update":
        await upsert(event.ResourceProperties);
        break;
      case "Delete":
        await destroy(event.ResourceProperties);
        break;
    }
    console.info("Processed request to update the RUM tempalt", {
      props: event.ResourceProperties,
      requestType: event.RequestType,
    });

    await sendSuccessMessage(event);
    return;
  } catch (e) {
    console.error(e);
    await sendFailureMessage(event);
  }
};

// PRIVATE

const upsert = async ({ appMonitorName, s3BucketName }: CustomProperties) => {
  const file = await rumFileService(appMonitorName);
  console.info("Built rum script");

  const props = {
    Bucket: s3BucketName,
    Key: "rum.js",
    Body: file,
  };
  console.info("Uploading the script with props", props);

  await s3.putObject(props).promise();
  console.info("Script was uploaded");
};

const destroy = async ({ appMonitorName, s3BucketName }: CustomProperties) => {
  const props = {
    Bucket: s3BucketName,
    Key: "rum.js",
  };
  console.info("Deleting the script with props", props);

  await s3.deleteObject(props).promise();

  console.info("Script was deleted");
};
