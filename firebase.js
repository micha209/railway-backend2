const admin = require('firebase-admin');

const serviceAccount = {
   "type": "service_account",
  "project_id": "prixmathaiti",
  "private_key_id": "c15975bb5c797b308017b5ed59d639e7f117622d",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCq6qsY2zuF0wHI\nWqXaFU5CmaBvUHj4p4hdAFdXlEUD/abYrYps4HcPeVgOV6+p86P65OHkcofGirxa\nvhUYflt2UrmV/K3bRGIYruaMarm4LFIioDy/hSgbUcTI//HMHdgElG4UK2eyt+5L\n5VMLhU3/ud+2KGcUr0SMlw3NBGThCgRjxX+JtFW5/ghXSLWCrf/GX0PVgBYDt31D\nuWYnyWgnUkE8X1L2jOi9R3M4TVyHs3M+DrWAS1NVu99/Y7dco+G+0SuV6MmxSk58\nMl5h0uCDjlMDcu2ccIj4hlbjut6p89hv5TUkg+keTAFcBU4JcXHk8VbWAQ1LOKNd\nCqUtfzH5AgMBAAECggEAJd5dr2Gvo/x2+iW/dnze/JmeNtudGfbAm15+e5yR2AsE\nwyBcObhYGNkZXgAmnyCo1eeNdzi7BY3qoq5X7Tfd2u8ESIuWF61kkLR7x2PEJ17G\nif53xzVhCACLeb9fmwqHuKgMZbKiRLJE/ZLfXf+Yow7TVsBH6ojUxtOXDrQpB8T7\nlix6q46u84G1/X92BXtlHxYmQvnpMmPH+Atq+PwfA9gSDGRZuL4miDQSgE7uJ/1R\nCtcnmOi2Dpw1z6dITw2BRWG3odfYN6CnUc/IvQsWEZzEVnCu/j2jaj0oPkEWf31+\nu+xAU2i90ajJADV5KJjZHYU0rVd9sCkUzg2kZUgQKQKBgQDrDchUaoKMUOGtqdIr\nCy4PG7J5fF9bT+E/PToDfRFMjWhUveQ4p2EGeZEAxDru6KdWjj9pF/wMz4oDKvAY\nSL2SlMX3BBTlHIQaQKFpzj/V2mvavr13REZqxnXyhXeUX+WUQEYNX8l2bwSMJiDB\nLYuXEyXxx45m43LB2KjkNmZtrQKBgQC6Jb4bmQfn7NmUZ3aIH3tzjdF7TPyDg7cr\n5U+HHn7PPIZb37IiMni88Z/ZrjxBsChvOpLvAFRxFjYnrxiNkuTCyQ9bZjF5IlRr\nWrDLcrk3zKdXThQ1WhD3NVwPt9hZd7EWJ6cwuwoP6bi4dhE8hog3fsbefiQtYT66\nYmjHw1XG/QKBgHZkoMz0QQFQE/wXF4cawH5XoxPR823Y1Em4Gyp6qmX2q+BTLUrj\n89kBDmpmbJC9mtvcFlBnBkullYx26iwxJ1tXmEcNRUEJlfhrKWJTwo+CzuSFQoV6\nXEWX5PzdARg5HTgJD7/YyW7gCFhXNBRZToAv4uLfcvicA8djy933EKyZAoGBALYf\nZzipKMsJOHeyIo5b/vS3tFTmpcgmfng8CuswMvGfTfVlj2tV5js2TCc2CU5bg7QP\nouKjd/qMuL9q2KLrLVZGUPgjrBPQOrguKvtia0TkvnT0t2Dble3IDyJxxQMD0AbV\nFQbgeJ/JFCmlmoeVOIDTUM8uq0aa9jx1O/72Zl4hAoGBAN+IZBlPl9gLYBCOS10O\n0U5buip8rL9JTVTn1eBrjroIJHPQ70b8OGHwFOtDWI08Tisy2J641SEv67hKWhCj\nV3SCLixSVlLntA6+ZZQ0U8kFllYYIs4cl5+voy5G607xg8X9DbOMxRSlge3rA+Kg\ntpAXwLgWlXMClEDz5tbp8Ack\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@prixmathaiti.iam.gserviceaccount.com",
  "client_id": "115468581086832524731",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40prixmathaiti.iam.gserviceaccount.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

module.exports = admin.database();
