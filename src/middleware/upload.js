import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function makeCloudinaryUpload(folder) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => ({
      folder: `evergreen/${folder}`,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id:
        `${Date.now()}-${file.originalname
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-z0-9-_]/gi, '-')
          .replace(/-+/g, '-')
          .slice(0, 70)}`
    })
  });

  return multer({
    storage,
    limits: {
      fileSize: 8 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowed.includes(file.mimetype)) {
        const error = new Error(
          'Only JPG, PNG and WEBP images are allowed.'
        );
        error.status = 400;
        return cb(error);
      }

      cb(null, true);
    }
  });
}

export const galleryUpload =
  makeCloudinaryUpload('gallery');

export const eventUpload =
  makeCloudinaryUpload('events');

export const newsUpload =
  makeCloudinaryUpload('news');

export { cloudinary };