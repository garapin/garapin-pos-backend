export const getNumberOfDays = async (startDateString, endDateString) => {
  // Parse the date strings into Date objects
  const startDate = new Date(startDateString);
  const endDate = new Date(endDateString);

  // Calculate the difference in milliseconds
  const differenceInMilliseconds = endDate - startDate;

  // Convert the difference from milliseconds to days
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const numberOfDays = differenceInMilliseconds / millisecondsPerDay;

  return numberOfDays;
};
