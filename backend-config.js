// Optional backend service (see server/README.md). Contains no secrets —
// just the URL of the deployed automation/trust-boundary service, same
// exposure model as firebase-config.js's apiKey. Leave apiUrl empty to
// keep admin.html/report.html on their existing direct-Firestore
// behavior; fill it in once server/ is deployed to Hostinger.
const BACKEND_CONFIG = {
  apiUrl: ''
};
