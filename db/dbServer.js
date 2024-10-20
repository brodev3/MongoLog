const log = require('../utils/logger');
const { Wallet, Log, Project } = require('./dbConnector');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

class DBServer {
    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return { dateStr: `${day}.${month}.${year}`, timeStr: `${hours}:${minutes}:${seconds}` };
    };

    async getAllProjectNames() {
        try {
            log.info('Getting all project names');
            const projects = await Project.find({}, 'name').lean();
            return projects.map(project => project.name);
        } catch (err) {
            log.error('Error getting project names:', err);
            throw err;
        };
    };

    async getFilteredLogs({ projectName, walletAddresses, startDate, endDate }) {
        try {
            const filter = {};
            if (projectName) {
                const project = await Project.findOne({ name: projectName }).lean();
                if (!project) throw new Error(`The project with name ${projectName} was not found`);
                filter.project_name = project.name;
            }
            if (startDate || endDate) {
                filter.date = {};
                if (startDate) filter.date.$gte = startDate;
                if (endDate) filter.date.$lte = endDate;
            };

            const logs = await Log.find(filter).sort({ date: -1 }).lean();
            return logs;
        } catch (err) {
            log.error('Error receiving filtered logs:', err);
            throw err;
        };
    };

    async getWalletsByAddressesOrProject({ walletAddresses, projectName }) {
        try {
            let wallets;
            if (walletAddresses && walletAddresses.length > 0) {
                const addressesLowerCase = walletAddresses.map(addr => addr.toLowerCase());
                wallets = await Wallet.find({ addressLowCase: { $in: addressesLowerCase } }).lean();
            } else if (projectName) {
                const project = await Project.findOne({ name: projectName }).lean();
                if (!project) throw new Error(`Project with name "${projectName}" was not found`);
                wallets = await Wallet.find({ 'projects.project_id': project._id }).lean();
            }
            return wallets;
        } catch (err) {
            log.error('Error receiving wallets:', err);
            throw err;
        };
    };

    async extractMetrics(projectName) {
        const allMetricFields = new Set();
        const formattedWallets = [];
        const wallets = await Wallet.find({ 'projects.project_name': projectName }).lean();
        wallets.forEach(wallet => {
            const project = wallet.projects.find(p => p.project_name === projectName);
            if (project && project.metrics) {
                const walletMetrics = {};
                Object.keys(project.metrics).forEach(metric => {
                    if (metric !== 'last_updated') {
                        allMetricFields.add(metric);
                        walletMetrics[metric] = project.metrics[metric];
                        walletMetrics.index = wallet.index;
                    }
                });
                formattedWallets.push({ address: wallet.address, ...walletMetrics });
            };
        });
        return { metricFields: Array.from(allMetricFields), wallets: formattedWallets };
    };

    createExcelFileFromStrings({ dataArrayLogs, formattedMetrics, dataArrayInfo }, fileNamePrefix) {
        try {
            const book = xlsx.utils.book_new();
            const infoSheet = xlsx.utils.aoa_to_sheet(dataArrayInfo);
            xlsx.utils.book_append_sheet(book, infoSheet, 'Info');

            if (formattedMetrics) {
                const metricSheet = xlsx.utils.aoa_to_sheet(formattedMetrics);
                xlsx.utils.book_append_sheet(book, metricSheet, 'Metrics');
            };

            const logSheet = xlsx.utils.aoa_to_sheet(dataArrayLogs);
            xlsx.utils.book_append_sheet(book, logSheet, 'Logs');

            const { dateStr, timeStr } = this.formatDate(new Date());
            const fileName = `${fileNamePrefix}_${timeStr.replace(/:/g, '-')}_${dateStr}.xlsx`;

            const filePath = path.join(path.resolve(__dirname, '..'), '/reports/' + fileName);
            xlsx.writeFile(book, filePath);

            log.success(`Excel file created successfully: ${filePath}`);
            return filePath;
        } catch (error) {
            log.error('Error creating Excel file:', error);
            return null;
        };
    };

    async generateLogsExcelReport({ projectName, walletAddresses, startDate, endDate, fileNamePrefix }) {
        try {
            log.info(`Generating report for project: ${projectName}`);
            const logs = await this.getFilteredLogs({ projectName, walletAddresses, startDate, endDate });
            if (logs.length === 0) {
                log.warn('No logs were found for the specified filters.');
                return null;
            };

            const formattedLogs = logs.map(log => ({
                index: log.index || '',
                wallet: log.wallet || '',
                project: log.project_name,
                date: log.date ? this.formatDate(log.date).dateStr : '',
                time: log.date ? this.formatDate(log.date).timeStr : '',
                level: log.level,
                action: log.action,
                message: log.message,
                stack_trace: log.stack_trace
            }));

            let formattedMetrics;
            if (projectName) {
                const { metricFields, wallets } = await this.extractMetrics(projectName);
                const headers = ['Index', 'Wallet', ...metricFields.map(header => header.charAt(0).toUpperCase() + header.slice(1))];
                formattedMetrics = [
                    headers,
                    ...wallets.map(wallet => {
                        return headers.map(header => {
                            const key = header.toLowerCase();
                            if (key === 'wallet') return wallet.address || 'Unknown';
                            return wallet[key] || '';
                        });
                    })
                ];
            }

            const dataArrayLogs = [
                ['Index', 'Wallet', 'Project', 'Date', 'Time', 'Level', 'Action', 'Message', 'Stack Trace'],
                ...formattedLogs.map(log => [
                    log.index, log.wallet, log.project, log.date, log.time, log.level, log.action, log.message, log.stack_trace
                ])
            ];

            const dataArrayInfo = [[`Report type: ${fileNamePrefix}`], [`Project: ${projectName || ''}`], [`Start Date: ${startDate || ''}`], [`End Date: ${endDate || ''}`]].filter(Boolean);

            return this.createExcelFileFromStrings({ dataArrayLogs, formattedMetrics, dataArrayInfo }, fileNamePrefix);
        } catch (error) {
            log.error('Error generating report:', error);
            throw error;
        };
    };
};

module.exports = new DBServer();
