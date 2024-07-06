const convertToISODateString = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString().replace("Z", ""); // Remove 'Z' to keep local time zone
};
export { convertToISODateString };
