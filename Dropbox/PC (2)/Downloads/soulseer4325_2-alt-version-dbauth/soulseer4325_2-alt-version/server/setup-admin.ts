import { Client, Account, Teams } from 'appwrite';

const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject('681831b30038fbc171cf');

const account = new Account(client);
const teams = new Teams(client);

async function setupAdmin() {
    try {
        // Create admin account
        const user = await account.create(
            'unique()', // User ID will be auto-generated
            'emilynnj14@gmail.com',
            'JayJas1423!',
            'Emily' // Name
        );

        console.log('Admin account created:', user);

        // Create admin team if it doesn't exist
        try {
            const adminTeam = await teams.create('admin', 'Admin Team');
            console.log('Admin team created:', adminTeam);

            // Add user to admin team
            await teams.createMembership(
                adminTeam.$id,
                ['admin'], // Roles
                'https://nyc.cloud.appwrite.io/v1/account/verification', // URL for email verification
                user.$id
            );
            console.log('User added to admin team');
        } catch (error) {
            console.log('Admin team already exists or error:', error);
        }

        console.log('Admin setup completed successfully');
    } catch (error) {
        console.error('Error setting up admin:', error);
    }
}

setupAdmin(); 