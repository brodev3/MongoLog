const dbServer = require('../db/dbServer');
const log = require('../utils/logger');

class WalletService {
    async getWalletsByAddressesOrProject({ walletAddresses, projectName }) {
        try {
            log.info(`Request to obtain data about wallets for the project: ${projectName || 'Not specified'} and wallets: ${walletAddresses || 'Not specified'}`);
            const wallets = await dbServer.getWalletsByAddressesOrProject({
                walletAddresses, 
                projectName
            });

            log.success(`Wallet data successfully retrieved for project: ${projectName || 'Not specified'}`);
            return wallets;
        } catch (error) {
            log.error(`Error while retrieving wallet data: ${error.message}`);
            throw error;
        };
    };
};

module.exports = WalletService;
