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
  const url = process.env.URL_MAILER_API;
  const apiToken = process.env.MAILER_TOKEN;
  const templateUUID = process.env.TEMPLATE_UUID;

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
