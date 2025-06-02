// import { Client, Account, Teams } from 'appwrite'; // Appwrite imports removed

// Appwrite client initialization removed
// const client = new Client()
//     .setEndpoint('https://nyc.cloud.appwrite.io/v1')
//     .setProject('681831b30038fbc171cf');

// const account = new Account(client);
// const teams = new Teams(client);

async function setupAdmin() {
    console.warn("TODO: The admin setup script (server/setup-admin.ts) needs to be rewritten.");
    console.warn("This script was previously Appwrite-specific and its Appwrite parts have been removed.");
    console.warn("If you need to create an admin user, adapt this script to use your new auth system (e.g., storage.createUser with hashed password).");
    // try {
    //     // Create admin account using Appwrite (original logic commented out)
    //     // const user = await account.create(
    //     //     'unique()', // User ID will be auto-generated
    //     //     'emilynnj14@gmail.com',
    //     //     'JayJas1423!',
    //     //     'Emily' // Name
    //     // );

    //     // console.log('Admin account created:', user);

    //     // // Create admin team if it doesn't exist
    //     // try {
    //     //     const adminTeam = await teams.create('admin', 'Admin Team');
    //     //     console.log('Admin team created:', adminTeam);

    //     //     // Add user to admin team
    //     //     await teams.createMembership(
    //     //         adminTeam.$id,
    //     //         ['admin'], // Roles
    //     //         'https://nyc.cloud.appwrite.io/v1/account/verification', // URL for email verification
    //     //         user.$id
    //     //     );
    //     //     console.log('User added to admin team');
    //     // } catch (error) {
    //     //     console.log('Admin team already exists or error:', error);
    //     // }

    //     // console.log('Admin setup completed successfully');
    // } catch (error) {
    //     // console.error('Error setting up admin:', error);
    // }
}

setupAdmin(); 