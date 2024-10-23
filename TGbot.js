const TelegramBot = require('node-telegram-bot-api');
const ReportService = require('./services/ReportService');
const WalletService = require('./services/WalletService');
const LogService = require('./services/LogService');
const config = require("./config");
const log = require("./utils/logger");
const DB = require('./db/dbConnector');

class BotService {
    constructor() {
        this.bot = new TelegramBot(config.TGbot.token, { polling: true });
        this.allowedUsers = config.TGbot.allowedUsers;

        this.reportService = new ReportService();
        this.walletService = new WalletService();
        this.logService = new LogService();

        this.userFilters = {};
        this.walletInputs = {};
        this.projectInputs = {};
        this.startMessages = {}; 
        this.filterMessages = {}; 

        this.setupBot();
    };

    async setupBot() {
        await DB.connect();
        this.bot.onText(/\/start/, (msg) => this.onStart(msg));

        this.bot.on('callback_query', async (query) => this.onCallbackQuery(query));

        this.bot.on('message', async (msg) => this.onMessage(msg));
        log.info(`Bot and database are ready to go!`);
    };

    async onStart(msg) {
        const chatId = msg.chat.id;
        if (this.allowedUsers.includes(chatId)) {
            log.info(`User ${chatId} started working with the bot`);

            await this.deleteMessages(chatId, this.startMessages);

            this.resetUserState(chatId);

            this.sendMainMenu(chatId);
        } else {
            log.warn(`Access denied for user ${chatId}`);
            this.bot.sendMessage(chatId, `Sorry, you don't have access.`);
        };
    };

    async deleteMessages(chatId, messageStorage) {
        if (messageStorage[chatId] && messageStorage[chatId].length > 0) {
            for (const messageId of messageStorage[chatId]) {
                try {
                    await this.bot.deleteMessage(chatId, messageId);
                } catch (err) {
                    log.warn(`Failed to delete message ${messageId}: ${err.message}`);
                };
            };
            messageStorage[chatId] = []; 
        };
    };

    resetUserState(chatId) {
        delete this.userFilters[chatId];
        delete this.walletInputs[chatId];
        delete this.projectInputs[chatId];
    };

    sendMainMenu(chatId) {
        this.bot.sendMessage(chatId, `
👋 **Welcome, Brother!**

ℹ️ I’m **MongoLog** — a bot for generating reports from the database. 

⚙️ Still in development, but feel free to test the available features.

Created by: **@brodevv3**
    `, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 Full Report', callback_data: 'full_report' }],
                    [
                        { text: '💼 Wallet Report', callback_data: 'wallet_report' },
                        { text: '📁 Project Report', callback_data: 'project_report' }
                    ]
                ]
            }
        }).then((sentMessage) => {
            if (!this.startMessages[chatId]) this.startMessages[chatId] = [];
            this.startMessages[chatId].push(sentMessage.message_id);
        });
    };

    sendFilterByDateOptions(chatId) {
        this.bot.sendMessage(chatId, '📆 Filter by date?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Yes', callback_data: 'filter_yes' }, { text: '🚫 No', callback_data: 'filter_no' }],
                    [{ text: '⬅️ Back', callback_data: 'go_back' }]
                ]
            }
        }).then((sentMessage) => {
            if (!this.filterMessages[chatId]) this.filterMessages[chatId] = [];
            this.filterMessages[chatId].push(sentMessage.message_id);
        });
    };

    async onCallbackQuery(query) {
        const chatId = query.message.chat.id;
        if (!this.allowedUsers.includes(chatId))
            return;
        const messageId = query.message.message_id;

        switch (query.data) {
            case 'full_report':
                this.userFilters[chatId] = { filterType: 'full_report' };
                this.sendFilterByDateOptions(chatId);
                break;

            case 'wallet_report':
                this.userFilters[chatId] = { filterType: 'wallet_report' };
                this.bot.sendMessage(chatId, '💼 Enter wallets (one per line):');
                this.walletInputs[chatId] = [];
                break;

            case 'project_report':
                this.userFilters[chatId] = { filterType: 'project_report' };
                this.projectInputs[chatId] = [];
                const projectNames = await this.reportService.getAllProjectNames();
                if (projectNames.length === 0) {
                    this.bot.sendMessage(chatId, 'No projects available');
                    return;
                }
                this.sendProjectSelection(chatId, projectNames);
                break;

            case 'filter_yes':
                await this.deleteMessages(chatId, this.filterMessages);
                this.bot.sendMessage(chatId, `
✍️ Enter dates in the format **DD\\.MM\\.YY** \\- **DD\\.MM\\.YY** 
\\(leave one date blank for an open range\\)\n
❗️ *For example:*
\`01.01.24 \\- 31.12.24\`
\`01.01.24 \\-\`
\`\\- 01.01.24\`
`, { parse_mode: "MarkdownV2" });
                if (!this.userFilters[chatId])
                    this.userFilters[chatId] = {};
                this.userFilters[chatId].waitingFor = 'dates';
                break;

            case 'filter_no':
                await this.generateReport(chatId);
                break;

            case 'go_back':
                await this.deleteMessages(chatId, this.filterMessages); 
                break;

            default:
                if (query.data.startsWith('project_')) {
                    const selectedProject = query.data.replace('project_', '');
                    this.projectInputs[chatId].push(selectedProject);
                    this.sendFilterByDateOptions(chatId);
                }
                break;
        }
    }

    async onMessage(msg) {
        const chatId = msg.chat.id;
        if (!this.allowedUsers.includes(chatId) || !msg.text)
            return;

        const text = msg.text?.trim();

        if (this.userFilters[chatId]?.waitingFor === 'wallets') {
            const wallets = text.split('\n').map(wallet => wallet.trim()).filter(wallet => wallet !== '');
            this.walletInputs[chatId] = wallets;
            this.bot.sendMessage(chatId, `💼 ${wallets.length} wallets received`);
            this.userFilters[chatId].receivedWallets = true;
        } else if (this.userFilters[chatId]?.waitingFor === 'dates') {
            const { startDate, endDate } = this.parseDateRange(text);
            if (!startDate && !endDate) {
                this.bot.sendMessage(chatId, '❌ Invalid date format.\nPlease use the format `DD.MM.YY - DD.MM.YY`');
            } else {
                await this.generateReport(chatId, { startDate, endDate });
            }
        }
    }

    async generateReport(chatId, dateRange = {}) {
        try {
            const filterType = this.userFilters[chatId]?.filterType || 'Unknown filter';
            const wallets = this.walletInputs[chatId] || [];
            const project = this.projectInputs[chatId] || [];
            
            const filter = {
                projectName: project[0] || '',
                walletAddresses: wallets,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                fileNamePrefix: filterType
            };

            const file = await this.reportService.generateReport(filter);
            if (file) {
                await this.bot.sendDocument(chatId, file);
                log.success(`Report sent to user ${chatId}`);
            } else {
                await this.bot.sendMessage(chatId, 'The report was not found.');
            }
            this.sendMainMenu(chatId);
            this.resetUserState(chatId);
        } catch (err) {
            
            log.error(`Error generating report for user ${chatId}: ${err.message}`);
            this.bot.sendMessage(chatId, '❌ Error generating report');
        }
    }

    sendProjectSelection(chatId, projectNames) {
        const projectButtons = projectNames.map(name => [{ text: name, callback_data: `project_${name}` }]);
        this.bot.sendMessage(chatId, '📁 Select project:', {
            reply_markup: {
                inline_keyboard: projectButtons
            }
        });
    }

    parseDateRange(dateRangeStr) {
        const [fromDate, toDate] = dateRangeStr.split('-').map(date => date.trim());
        const startDate = this.convertToLocal(fromDate);
        const endDate = this.convertToLocal(toDate, true);
        return { startDate, endDate };
    }

    convertToLocal(dateStr, endOfDay = false) {
        const dateRegex = /^\d{2}\.\d{2}\.\d{2}$/;
        if (!dateRegex.test(dateStr)) return null;
        const [day, month, year] = dateStr.split('.').map(Number);
        const fullYear = year < 100 ? 2000 + year : year;
        if (endOfDay) return new Date(fullYear, month - 1, day, 23, 59, 59);
        return new Date(fullYear, month - 1, day, 0, 0, 0); 
    }

    convertToUTC(dateStr, endOfDay = false) {
        const dateRegex = /^\d{2}\.\d{2}\.\d{2}$/;
        if (!dateRegex.test(dateStr)) return null;
        const [day, month, year] = dateStr.split('.').map(Number);
        const fullYear = year < 100 ? 2000 + year : year;
        if (endOfDay) return new Date(Date.UTC(fullYear, month - 1, day, 23, 59, 59));
        return new Date(Date.UTC(fullYear, month - 1, day, 0, 0, 0));
    }
}

new BotService();
