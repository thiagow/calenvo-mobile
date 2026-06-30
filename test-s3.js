const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function main() {
    console.log("Testing direct S3 Upload using environment variables...");

    // Ler os mesmos nomes de variaveis do .env local que estao na Netlify
    const bucketName = process.env.AWS_BUCKET_NAME;
    const folderPrefix = process.env.AWS_FOLDER_PREFIX || '';

    if (!bucketName) {
        console.error("Missing AWS_BUCKET_NAME");
        return;
    }

    const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'auto',
        endpoint: process.env.AWS_ENDPOINT,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        }
    });

    const fileName = 'test-upload-script.txt';
    const key = `${folderPrefix}${Date.now()}-${fileName}`;

    const buffer = Buffer.from("Test content");

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'text/plain'
    });

    try {
        console.log(`Uploading to bucket ${bucketName} with key ${key}...`);
        await s3Client.send(command);
        console.log("Upload successful!");
    } catch (error) {
        console.error("Upload failed with error:");
        console.error(error);
    }
}

main();
