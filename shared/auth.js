import appwrite from './appwrite.config';

const createAccount = async (email, password, name) => {
  try {
    const user = await appwrite.account.create('unique()', email, password, name);
    return user;
  } catch (error) {
    console.error('Error creating account:', error);
    throw error;
  }
};

const login = async (email, password) => {
  try {
    const session = await appwrite.account.createEmailSession(email, password);
    return session;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

const getCurrentUser = async () => {
  try {
    const user = await appwrite.account.get();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

export { createAccount, login, getCurrentUser };
