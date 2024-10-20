const dbServer = require('../db/dbServer');
const log = require('../utils/logger'); 

class ReportService {
    async generateReport({ projectName, walletAddresses, startDate, endDate, fileNamePrefix }) {
        try {
            log.info(`Start report generation for project: ${projectName}`);

            const file = await dbServer.generateLogsExcelReport({
                projectName, 
                walletAddresses, 
                startDate, 
                endDate, 
                fileNamePrefix
            });

            if (!file) 
                throw new Error(`Report was not generated for project: ${projectName}`);
            

            log.success(`Report generated successfully for project: ${projectName}`);
            return file;
        } catch (error) {
            log.error(`Error generating report for project ${projectName}: ${error.message}`);
            throw error;
        };
    };

    async getAllProjectNames() {
        return await dbServer.getAllProjectNames();
    };
};

module.exports = ReportService;
