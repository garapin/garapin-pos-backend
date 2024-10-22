import axios from "axios";

/**
 * Fungsi untuk mengirim email menggunakan Mailtrap
 * @param {string} recipientEmail - Email penerima
 * @param {string} recipientFullName - Nama lengkap penerima
 * @param {string} companyName - Nama perusahaan
 * @param {string} companyPic - PIC perusahaan
 * @param {string} companyPhone - Nomor telepon perusahaan
 * @param {string} senderEmail - Email pengirim
 * @param {string} databaseName - Nama database
 */
export const sendMail = async (
  recipientEmail,
  companyName,
  companyPic,
  companyPhone,
  senderEmail,
  databaseName
) => {
  const url = "https://send.api.mailtrap.io/api/send";
  const apiToken = "2e4751e6a99d6cb9792d1d6f90dd3a6c"; // API Token dari Mailtrap
  const templateUUID = "3ab1116d-afc0-478f-a790-f68ce1b56d2b"; // Template UUID Mailtrap

  const data = {
    from: {
      email: "office@bagibagipos.com",
      name: "Bagi Bagi Pos",
    },
    to: [
      {
        email: recipientEmail,
      },
    ],
    template_uuid: templateUUID,
    template_variables: {
      recipient_full_name: recipientEmail,
      company_info_name: companyName,
      company_pic: companyPic,
      company_info_phone: companyPhone,
      email: senderEmail,
      database_name: databaseName,
    },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log("Email sent successfully:", response.data);
  } catch (error) {
    console.error(
      "Error sending email:",
      error.response ? error.response.data : error.message
    );
  }
};
