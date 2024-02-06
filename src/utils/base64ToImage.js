import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const saveBase64Image = (base64Data, targetDirectory) => {
  try {
    const metadata = base64Data.split(';')[0];
    const imageFormat = metadata.split('/')[1];

    const base64Image = base64Data.split(';base64,').pop();
    const imageBuffer = Buffer.from(base64Image, 'base64');

    const filename = `image_${Date.now()}.${imageFormat}`;
    const filePath = join(targetDirectory, filename);

    if (!existsSync(targetDirectory)) {
      mkdirSync(targetDirectory, { recursive: true });
    }

    writeFileSync(filePath, imageBuffer);

    return filePath;
  } catch (error) {
    console.error('Failed to save base64 image:', error);
    throw new Error('Failed to save base64 image');
  }
};

export default saveBase64Image;
