import { ConfigAppModel, configAppSchema } from '../models/configAppModel.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
const versionApps = async (req, res) => {
const version = await ConfigAppModel.findOne();
return apiResponse(res, 200, 'get version', version);
};


const loginTest = async (req, res) => {
const version = await ConfigAppModel.findOne();
return apiResponse(res, 200, 'get version', version);
};

export default { versionApps, loginTest };