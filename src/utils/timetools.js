import moment from'moment-timezone';


const  isExpired = ( expiryDate ) => {
  const now = moment().tz('GMT').format();
 
  console.log(now);
  console.log(expiryDate);
  
  
  
  return now > expiryDate;
  
}

const isIncoming = (endDate,due_date ) => {
  const now = moment().tz('GMT');
  const end_date = moment(endDate).tz('GMT');
  const daysUntilDue = end_date.diff(now, 'days');
  const isDueDate = (daysUntilDue <= due_date) && (now.isBefore(end_date));  
  console.log(end_date);
  console.log(daysUntilDue);
  
  console.log(isDueDate);
  
  // console.log(xxx);
  
  return isDueDate;
}


export default {
  isExpired,
  isIncoming,
};