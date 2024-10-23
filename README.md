# MongoLog

<p>
      <img src="https://i.ibb.co/3sHQCSp/av.jpg" >
</p>

<p >
   <img src="https://img.shields.io/badge/build-v_1.0-brightgreen?label=Version" alt="Version">
</p>


## About

MongoLog is a software solution for centralized storage of project, wallet, and log data from various sources. It is based on MongoDB using the Mongoose ORM and is divided into two main components: the server bot and the logging client.

<p align="center">
      <img src="https://i.ibb.co/s38jxXf/1.gif">
</p>

## Features

- Centralized storage of project, wallet, and log data.
- Report generation in Excel format with easy filtering by date and project.
- A simple and convenient Telegram bot interface for interacting with the system.

<p align="center">
      <img src="https://i.ibb.co/nz6R1MS/2.png">
</p>

## Server

The MongoLog server interacts with users via Telegram and generates reports based on data from the MongoDB database. The server supports:

- **Collection check and creation**: On startup, the server checks the existence of collections (projects, wallets, logs) and creates them if needed.
- **Action logging**: All server actions are logged to the console for easier debugging and monitoring.

### Data Structure

#### Wallets Collection

Stores information about wallets and associated projects:
- **address**: The wallet address.
- **addressLowCase**: The wallet address in lowercase for easier search.
- **index**: The wallet index.
- **projects**: An array of associated projects, each containing:
  - **project_id**: The project identifier.
  - **project_name**: The project name.
  - **added_at**: The date the project was added.
  - **metrics**: Metrics for the project, including points and the last updated date.
- **balances**: Information about wallet balances for different assets.

#### Logs Collection

Stores log entries related to wallets and projects:
- **wallet**: The wallet address related to the log.
- **project_name**: The name of the project associated with the log.
- **level**: Log level (error, success, fatal, debug, info, warn).
- **action**: The action performed.
- **message**: The log message.
- **stack_trace**: Stack trace for debugging errors.
- **date**: The log creation date (logs expire after 90 days).

#### Projects Collection

Stores information about projects:
- **name**: The project name.
- **wallet_ids**: Array of wallet identifiers associated with the project.
- **created_at**: The project creation date.
- **updated_at**: The date the project was last updated.

## Telegram Bot





The server bot interacts with users via Telegram, providing an interface for requesting data and generating reports.

- **Telegram Bot**: A simple interface for interacting with the user, allowing reports on stored data.
- **Data Filtering**: Supports filtering data by date and project, making it easier to find specific information.
- **Excel Report Generation**: Automatically generates reports in Excel format, saved in the program folder for further use.

<p align="center">
      <img src="https://i.ibb.co/8sBwfYV/1.png" >
</p>

## Logging Client

The logging client collects and records logs, centralizing information about system activities. This is particularly useful for managing multiple programs and projects since all logs are stored in one place, making analysis and data access more efficient.

- **Log Levels**: Supports various log levels (`error`, `success`, `fatal`, `debug`, `info`, `warn`), allowing efficient classification of events by importance.
- **Console Output**: Each log is also output to the console with timestamps and log levels for real-time monitoring.
- **Log Saving to MongoDB**: Logs are stored in the MongoDB database, providing centralized storage and easy access via Telegram bot and Excel reports.
- **Backup to Text Files**: For additional security, logs are also saved to text files.
- **Error Handling**: The client includes an error handler that records logs before a crash and sends a message to Telegram, helping to react quickly to issues.

---

# Installation and Setup Guide

## 1. Create a Telegram Bot and Get a Token

1. Open Telegram and find the **@BotFather** bot.
2. Use the `/newbot` command to create a new bot and follow the instructions.
3. After creating the bot, you will receive a **token**. Keep it safe as you'll need it later for configuration.

## 2. Set Up a MongoDB Cluster and Obtain a Connection String

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new cluster and choose the default Free Tier configuration.
3. After the cluster is created, go to the **Connect** tab and choose **Connect your application**.
4. Copy the connection string that looks like this:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
   ```
   Replace `USERNAME` and `PASSWORD` with your MongoDB credentials.

## 3. Configure the Project

1. In the project folder, rename the file `configEXAMPLE.js` to `config.js`.
2. Open the `config.js` file and update the following parameters:

   ```javascript
   module.exports = {
     mongoDB: {
       use: true,  // Set to true if you want to use MongoDB for logging
       URI: "mongodb+srv://USERNAME:PASSWORD@cluster0.mongodb.net/?retryWrites=true&w=majority",  // MongoDB connection string
       project_name: "Morph"  // Name of the project for logging
     },
     TGbot: {
       token: "YOUR_TELEGRAM_BOT_TOKEN",  // Telegram bot token
       allowedUsers: [1234567890, 9876543210]  // Array of Telegram user IDs allowed to interact with the bot
     }
   };
   ```

- **mongoDB.use**: Set to `true` to enable MongoDB logging.
- **mongoDB.URI**: MongoDB connection string from step 2.
- **mongoDB.project_name**: The project name for logging.
- **TGbot.token**: Your Telegram bot token from step 1.
- **TGbot.allowedUsers**: Array of Telegram user IDs that are allowed to interact with the bot.

## 4. Install Dependencies and Start the Project

1. Node JS
2. Clone the repository to your disk
3. Launch the console (for example, Windows PowerShell)
4. Specify the working directory where you have uploaded the repository in the console using the CD command
    ```
    cd C:\Program Files\brothers
    ```
5. Install packages
   
    ```
    npm install
    ```
6. Run MongoLog
    ```
    node TGbot
    ```

## License

Project **brodev3**/MongoLog distributed under the MIT license.
