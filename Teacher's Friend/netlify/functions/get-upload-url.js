const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.handler = async (event, context) => {
  // 1. CORS அனுமதிகள்
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // 2. Pre-flight ரெக்வஸ்டுகளுக்கான பாதுகாப்பு
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // 3. POST Method-ஐ மட்டும் அனுமதிக்கவும்
  if (event.httpMethod !== "POST") {
    return { 
        statusCode: 405, 
        headers, 
        body: JSON.stringify({ error: "Method Not Allowed - Only POST requests are accepted" }) 
    };
  }

  try {
    // 4. Body டேட்டா சரியாக வருகிறதா என சரிபார்த்தல்
    if (!event.body) {
        throw new Error("Request body is missing");
    }

    const body = JSON.parse(event.body);
    const { fileName, fileType, folder } = body; 

    if (!fileName || !fileType || !folder) {
        throw new Error("Missing required fields: fileName, fileType, or folder");
    }

    // 5. Cloudflare R2 உடன் இணைத்தல்
    const s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const fileKey = `${folder}/${Date.now()}_${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
    });

    // 5 நிமிடங்களுக்கு (300 நொடிகள்) செல்லுபடியாகும் URL-ஐ உருவாக்குதல்
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // 6. வெற்றி! Headers-உடன் பதிலை அனுப்புதல்
    return {
        statusCode: 200,
        headers, // CORS-க்கு இது மிகவும் முக்கியம்
        body: JSON.stringify({ uploadUrl: signedUrl, fileKey: fileKey })
    };

  } catch (error) {
    console.error("Backend Error:", error);
    // 7. பிழை ஏற்பட்டாலும் Headers-உடன் அனுப்ப வேண்டும் (இல்லையெனில் CORS பிழை வரும்)
    return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: error.message }) 
    };
  }
};
