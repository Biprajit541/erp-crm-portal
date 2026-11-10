// AWS Lambda entry point. API Gateway (HTTP API) forwards every request here,
// and serverless-http turns it into a normal Express request, so all routes,
// middleware and error handling are exactly the same as on the local server.
import serverless from "serverless-http";
import app from "./app";

export const handler = serverless(app, {
  // Responses with these content types are base64-encoded for API Gateway,
  // otherwise the challan PDFs would arrive corrupted.
  binary: ["application/pdf", "application/octet-stream", "image/*"],
});
