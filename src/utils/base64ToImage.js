import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid'; // Import uuid


const saveBase64Image = (base64Data, targetDirectory, targetDatabase) => {
  try {
    const uniqueId = uuidv4();
    const metadata = base64Data.split(';')[0];
    const imageFormat = metadata.split('/')[1];


    const base64Image = base64Data.split(';base64,').pop();
    // eslint-disable-next-line no-undef
    const imageBuffer = Buffer.from(base64Image, 'base64');

    const filename = `${Date.now()}${uniqueId}.${imageFormat}`;
    const filePath = join(`images/${targetDatabase}/${targetDirectory}`, filename);

    if (!existsSync(`images/${targetDatabase}/${targetDirectory}`)) {
      mkdirSync(`images/${targetDatabase}/${targetDirectory}`, { recursive: true });
    }
    writeFileSync(filePath, imageBuffer);

    return filePath;
  } catch (error) {
    console.error('Failed to save base64 image:', error);
    throw new Error('Failed to save base64 image');
  }
};

export default saveBase64Image;

// import { writeFileSync, mkdirSync, existsSync } from 'fs';
// import { join, extname } from 'path';
// import { v4 as uuidv4 } from 'uuid';

// const saveBase64Image = (base64Data, targetDirectory, targetDatabase) => {
//   try {
//     const uniqueId = uuidv4();
//     const metadata = base64Data.split(';')[0];
//     const fileType = metadata.split('/')[1];

//     let fileExtension;
//     if (fileType === 'pdf') {
//       fileExtension = 'pdf';
//     } else {
//       // Menentukan ekstensi file berdasarkan jenis file
//       fileExtension = extname(metadata).slice(1); // Mengambil ekstensi file dari metadata
//     }

//     const base64File = base64Data.split(';base64,').pop();
//     const fileBuffer = Buffer.from(base64File, 'base64');

//     const filename = `${Date.now()}${uniqueId}.${fileExtension}`;
//     const filePath = join(`files/${targetDatabase}/${targetDirectory}`, filename);

//     if (!existsSync(`files/${targetDatabase}/${targetDirectory}`)) {
//       mkdirSync(`files/${targetDatabase}/${targetDirectory}`, { recursive: true });
//     }
//     writeFileSync(filePath, fileBuffer);

//     return filePath;
//   } catch (error) {
//     console.error('Failed to save base64 file:', error);
//     throw new Error('Failed to save base64 file');
//   }
// };

// export default saveBase64Image;
