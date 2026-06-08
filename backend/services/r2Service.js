const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to .env'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME || 'inspire-lms-backups';

async function uploadBackupToR2(localFilePath, filename) {
  const client = getR2Client();

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file not found: ${localFilePath}`);
  }

  const fileBuffer = fs.readFileSync(localFilePath);
  const fileSize = fs.statSync(localFilePath).size;
  const key = `backups/${filename}`;

  await client.send(new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: fileBuffer,
    ContentType: 'application/octet-stream',
    ContentLength: fileSize,
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'source': 'inspire-lms-backup'
    }
  }));

  return {
    success: true,
    key,
    bucket: BUCKET(),
    filename,
    sizeBytes: fileSize,
    sizeMB: parseFloat((fileSize / 1024 / 1024).toFixed(2)),
    uploadedAt: new Date().toISOString()
  };
}

async function deleteFromR2(filename) {
  const client = getR2Client();
  const key = `backups/${filename}`;

  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET(),
    Key: key
  }));

  return { success: true, key };
}

async function listR2Backups() {
  const client = getR2Client();

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET(),
      Prefix: 'backups/'
    })
  );

  const files = (response.Contents || [])
    .filter(obj => obj.Key && obj.Key.endsWith('.sql'))
    .map(obj => {
      const filename = path.basename(obj.Key);
      const parts = filename.split('_');
      const type = parts[1] || 'manual';

      return {
        filename,
        key: obj.Key,
        type,
        sizeBytes: obj.Size,
        sizeMB: parseFloat((obj.Size / 1024 / 1024).toFixed(2)),
        lastModified: obj.LastModified,
        storageLocation: 'r2'
      };
    })
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  return files;
}

async function downloadFromR2(filename) {
  const client = getR2Client();
  const key = `backups/${filename}`;

  const response = await client.send(
    new GetObjectCommand({
      Bucket: BUCKET(),
      Key: key
    })
  );

  return response.Body;
}

async function checkR2FileExists(filename) {
  try {
    const client = getR2Client();
    await client.send(new HeadObjectCommand({
      Bucket: BUCKET(),
      Key: `backups/${filename}`
    }));
    return true;
  } catch {
    return false;
  }
}

async function testR2Connection() {
  try {
    const client = getR2Client();
    await client.send(new ListObjectsV2Command({
      Bucket: BUCKET(),
      MaxKeys: 1
    }));
    return { success: true, message: 'R2 connection successful' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENABLED === 'true'
  );
}

module.exports = {
  uploadBackupToR2,
  deleteFromR2,
  listR2Backups,
  downloadFromR2,
  checkR2FileExists,
  testR2Connection,
  isR2Configured
};
