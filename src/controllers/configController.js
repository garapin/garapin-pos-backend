import { ConfigAppModel, configAppSchema } from '../models/configAppModel.js';
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';


const versionApps = async (req, res) => {
    console.log('version apps');
const version = await ConfigAppModel.findOne();
console.log(version);
return apiResponse(res, 200, 'get version', version);
};
const versionAppsV2 = async (req, res) => {
    console.log('version apps');
const version = await ConfigAppModel.find();
console.log(version);
return apiResponse(res, 200, 'get version', version);
};


const loginTest = async (req, res) => {
const version = await ConfigAppModel.findOne();
console.log(version);
return apiResponse(res, 200, 'get version', version);
};

export default { versionApps, loginTest, versionAppsV2 };