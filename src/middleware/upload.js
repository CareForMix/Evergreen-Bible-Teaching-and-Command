import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

function makeStorage(folderName) {
  const destination = path.resolve('uploads', folderName);

  fs.mkdirSync(destination, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, destination);
    },

    filename: (_req, file, cb) => {
      const ext = path
        .extname(file.originalname)
        .toLowerCase();

      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9-_]/gi, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);

      const unique =
        Date.now() +
        '-' +
        Math.round(Math.random() * 1e9);

      cb(
        null,
        `${safeBase || 'image'}-${unique}${ext}`
      );
    }
  });
}

function imageFilter(_req, file, cb) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp'
  ];

  const ext = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    !allowedMimeTypes.includes(file.mimetype) ||
    !allowedExtensions.includes(ext)
  ) {
    const error = new Error(
      'Only JPG, JPEG, PNG, and WEBP images are allowed.'
    );

    error.status = 400;
    return cb(error);
  }

  cb(null, true);
}

const uploadLimits = {
  fileSize: 8 * 1024 * 1024
};

export const galleryUpload = multer({
  storage: makeStorage('gallery'),
  fileFilter: imageFilter,
  limits: uploadLimits
});

export const eventUpload = multer({
  storage: makeStorage('events'),
  fileFilter: imageFilter,
  limits: uploadLimits
});

export const newsUpload = multer({
  storage: makeStorage('news'),
  fileFilter: imageFilter,
  limits: uploadLimits
});