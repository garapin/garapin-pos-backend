export const formatDatetime = (date) => {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" };
  const formattedDate = new Intl.DateTimeFormat("en-CA", options).format(date);

  return formattedDate;
};
