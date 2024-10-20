const mongoose = require('mongoose');
const log = require('../utils/logger');
const config = require('../config');

class DBConnector {
    constructor() {
        this.walletSchema = new mongoose.Schema({
            address: String,
            addressLowCase: String,
            index: Number,
            projects: [
                {
                    project_id: String,
                    project_name: String,
                    added_at: { type: Date, default: Date.now },
                    metrics: {
                        points: String,
                        last_updated: { type: Date, default: Date.now }
                    }
                }
            ],
            balances: {
                type: Map,
                of: {
                    balance: { type: Map, of: Number },
                    added_at: { type: Date, default: Date.now },
                    last_updated: { type: Date, default: Date.now }
                }
            }
        });

        this.walletSchema.index({ address: 1 });
        this.walletSchema.index({ addressLowCase: 1 });
        this.walletSchema.index({ 'projects.project_name': 1 });

        this.Wallet = mongoose.model('Wallet', this.walletSchema);

        this.logSchema = new mongoose.Schema({
            index: Number,
            wallet: String,
            project_name: String,
            level: String,
            action: String,
            message: String,
            stack_trace: String,
            date: { type: Date, default: Date.now, index: { expires: '90d' } }
        });

        this.logSchema.index({ project_name: 1 });
        this.logSchema.index({ wallet: 1 });
        this.logSchema.index({ level: 1 });
        this.logSchema.index({ date: 1 });

        this.Log = mongoose.model('Log', this.logSchema);

        this.projectSchema = new mongoose.Schema({
            name: String,
            wallet_ids: [String],
            created_at: { type: Date, default: Date.now },
            updated_at: { type: Date, default: Date.now }
        });

        this.projectSchema.index({ name: 1 });
        this.Project = mongoose.model('Project', this.projectSchema);
    };

    async connect() {
        try {
            await mongoose.connect(config.mongoDB.URI, { ssl: true });
            log.info('Successful connection to MongoDB [1/3]');

            await this.ensureCollectionsExist();
            log.info('Collection verification is complete [2/3]');

            await this.ensureIndexesExist();
            log.info('Index verification is complete [3/3]');;
        } catch (error) {
            log.error(`Error connecting to MongoDB: ${error.message}`);
            throw error;
        };
    };

    async ensureCollectionsExist() {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        if (!collectionNames.includes('wallets')) {
            log.warn("Collection 'wallets' not found, create a new collection");
            await this.Wallet.createCollection();
        };

        if (!collectionNames.includes('logs')) {
            log.warn("Collection 'logs' not found, create a new collection");
            await this.Log.createCollection();
        };

        if (!collectionNames.includes('projects')) {
            log.warn("Collection 'projects' not found, create a new collection");
            await this.Project.createCollection();
        };
    };

    async ensureIndexesExist() {
        const projectIndexes = await this.Project.listIndexes();
        const hasProjectNameIndex = projectIndexes.some(index => index.key && index.key.name);

        if (!hasProjectNameIndex) {
            log.warn("Index on 'projects.name' not found, creating index");
            await this.Project.createIndexes({ name: 1 });
            log.info("Index on 'projects.name' created successfully");
        };

        const walletIndexes = await this.Wallet.listIndexes();
        const requiredWalletIndexes = [
            { field: 'address', key: { address: 1 } },
            { field: 'addressLowCase', key: { addressLowCase: 1 } },
            { field: 'projects.project_name', key: { 'projects.project_name': 1 } }
        ];

        for (const { field, key } of requiredWalletIndexes) {
            const hasIndex = walletIndexes.some(index => index.key && index.key[field] === 1);

            if (!hasIndex) {
                log.warn(`Index on 'wallets.${field}' not found, creating index`);
                await this.Wallet.createIndexes(key);
                log.info(`Index on 'wallets.${field}' created successfully`);
            };
        };

        const logIndexes = await this.Log.listIndexes();
        const requiredLogsIndexes = [
            { field: 'project_name', key: { project_name: 1 } },
            { field: 'wallet', key: { wallet: 1 } },
            { field: 'level', key: { level: 1 } },
            { field: 'date', key: { date: 1 } }
        ];

        for (const { field, key } of requiredLogsIndexes) {
            const hasIndex = logIndexes.some(index => index.key && index.key[field] === 1);

            if (!hasIndex) {
                log.warn(`Index on 'logs.${field}' not found, creating index`);
                await this.Log.createIndexes(key);
                log.info(`Index on 'logs.${field}' created successfully`);
            };
        };
    };
};

module.exports = new DBConnector();
