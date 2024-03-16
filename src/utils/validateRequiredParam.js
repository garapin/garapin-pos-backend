// validateRequiredParams.js
import { apiResponseList, apiResponse } from './apiResponseFormat.js';

const validateRequiredParams = (res, requiredParams, requestBody) => {
    const missingParams = requiredParams.filter(param => !requestBody[param]);
  
    if (missingParams.length > 0) {
      const formattedMissingParams = missingParams.map(param => param.replace(/_/g, ' '));
      const missingParamString = formattedMissingParams.join(', ');
      return `Tidak boleh kosong: ${missingParamString}`;
    } else {
      return true;
    }
    
  };
  
  export default  validateRequiredParams;
  