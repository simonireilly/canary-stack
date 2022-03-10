import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceFailedResponse,
  CloudFormationCustomResourceSuccessResponse,
} from "aws-lambda";
import axios from "axios";

export const sendFailureMessage = async (
  event: CloudFormationCustomResourceEvent
) => {
  const errorResponse: CloudFormationCustomResourceFailedResponse = {
    Status: "FAILED",
    Reason: "Error when updating stack",
    PhysicalResourceId: `RumScriptUploader-${event.StackId}`,
    LogicalResourceId: event.LogicalResourceId,
    RequestId: event.RequestId,
    StackId: event.StackId,
  };

  console.info("Sending success response", errorResponse);

  const data = JSON.stringify(errorResponse);
  return axios.put(event.ResponseURL, data, {
    headers: {
      "content-type": "",
      "content-length": data.length,
    },
  });
};

export const sendSuccessMessage = async (
  event: CloudFormationCustomResourceEvent
) => {
  const successResponse: CloudFormationCustomResourceSuccessResponse = {
    Status: "SUCCESS",
    Reason: "Sent all required env vars to vercel",
    PhysicalResourceId: `RumScriptUploader-${event.StackId}`,
    LogicalResourceId: event.LogicalResourceId,
    RequestId: event.RequestId,
    StackId: event.StackId,
  };

  console.info("Sending success response", successResponse);

  const data = JSON.stringify(successResponse);
  return await axios.put(event.ResponseURL, data, {
    headers: {
      "content-type": "",
      "content-length": data.length,
    },
  });
};
