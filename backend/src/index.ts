// Long-running server entry point (local development and Render).
// The AWS Lambda entry point is src/lambda.ts; both share the same app.
import app from "./app";

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
