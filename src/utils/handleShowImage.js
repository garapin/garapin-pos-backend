export const showImage = async (req, image) => {
  try {
    let imageUrl = "";
    if (image && req) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const splitImage = image.split("\\").join("/");
      imageUrl = baseUrl + "/" + splitImage;
    }

    return imageUrl;
  } catch (error) {
    return null;
  }
};
