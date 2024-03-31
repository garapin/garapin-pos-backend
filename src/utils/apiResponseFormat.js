import { ConfigAppModel, configAppSchema } from '../models/configAppModel.js';

const apiResponseList = async (res, code, message, data = [], totalData = null, perPage = 10, currentPage = null) => {
    const user = await ConfigAppModel.findOne();
    const totalPages = Math.ceil(totalData / perPage);

    const response = {
        status: parseInt(code),
        message: message,
        data: data,
        total_data: parseInt(totalData),
        total_page: parseInt(totalPages),
        page: parseInt(currentPage),
        current_version: user.current_version
    };
    return res.status(code).json(response);
};


const apiResponse =async (res, code, message, data = null) => {
    const user = await ConfigAppModel.findOne();
    const response = {
        status: parseInt(code),
        message: message,
        data: data,
        current_version: user.current_version
    };
   return res.status(code).json(response);
};
export  { apiResponseList, apiResponse };