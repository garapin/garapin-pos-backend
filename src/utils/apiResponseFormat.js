// Fungsi untuk respons API dalam bentuk list
const apiResponseList = (res, code, message, data = [], totalData = null, perPage = 10, currentPage = null) => {
    const totalPages = Math.ceil(totalData / perPage);

    const response = {
        status: parseInt(code),
        message: message,
        data: data,
        total_data: parseInt(totalData),
        total_page: parseInt(totalPages),
        page: parseInt(currentPage),
    };
    return res.status(code).json(response);
};

// Fungsi untuk respons API
const apiResponse = (res, code, message, data = null) => {
    const response = {
        status: parseInt(code),
        message: message,
        data: data,
    };
   return res.status(code).json(response);
};
export  { apiResponseList, apiResponse };