const dbServer = require('../db/dbServer');
const log = require('../utils/logger');

class LogService {
    async getFilteredLogs({ projectName, walletAddresses, startDate, endDate }) {
        try {
            log.info(`Request to receive logs for the project: ${projectName}.`);

            const logs = await dbServer.getFilteredLogs({
                projectName, 
                walletAddresses, 
                startDate, 
                endDate
            });

            log.success(`Logs successfully received for project: ${projectName}`);
            return logs;
        } catch (error) {
            log.error(`Error while receiving logs: ${error.message}`);
            throw error;
        };
    };
};

module.exports = LogService;
