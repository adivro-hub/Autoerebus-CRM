import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

export function getUploadSignature(folder: string = "autoerebus/vehicles") {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const params: Record<string, string | number> = {
    timestamp,
    folder,
    transformation: "c_limit,w_1920,h_1440,q_auto,f_auto",
  };

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
  };
}
