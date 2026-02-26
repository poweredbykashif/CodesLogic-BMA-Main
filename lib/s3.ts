import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2Url = import.meta.env.VITE_R2_URL;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

export const s3Client = new S3Client({
    region: "auto",
    endpoint: r2Url,
    credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
    },
});

export const uploadToR2 = async (file: File, path: string): Promise<string> => {
    if (!r2Url || !accessKeyId || !secretAccessKey || !bucketName) {
        throw new Error("R2 credentials are not fully configured in .env");
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: path,
        Body: file,
        ContentType: file.type,
    });

    try {
        await s3Client.send(command);

        const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;
        if (!publicUrlBase) {
            // Fallback for internal use or if not configured
            return `${r2Url}/${bucketName}/${path}`;
        }

        // Ensure publicUrlBase doesn't end with a slash
        const base = publicUrlBase.endsWith('/') ? publicUrlBase.slice(0, -1) : publicUrlBase;
        return `${base}/${path}`;
    } catch (error: any) {
        console.error("R2 Upload Error:", error);
        throw new Error(`Failed to upload to R2: ${error.message}`);
    }
};
