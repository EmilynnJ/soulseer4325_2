import { Appwrite } from 'appwrite';

const appwriteConfig = {
  endpoint: 'https://nyc.cloud.appwrite.io/v1',
  project: '681831b30038fbc171cf',
};

const appwrite = new Appwrite();
appwrite.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.project);

export default appwrite;
