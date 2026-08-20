
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const figlet = require('figlet');
let localToken = {};
try {
    localToken = require('./nexstore/token');
} catch (error) {
    console.log(chalk.yellow('ℹ️ Local token file not found; using deployment environment variables.'));
}
const startupPassword = process.env.STARTUP_PASSWORD || localToken.startupPassword;
const AUTO_START = process.env.ELARA_AUTO_START === 'true';
let HOSTED_WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
const TELEGRAM_OFFICIAL_CHANNEL = process.env.TELEGRAM_OFFICIAL_CHANNEL || '@elarapairgc';
let activeProvider = String(process.env.ELARA_PROVIDER || '').toLowerCase();

const AUTH_FILE = './auth.json';
const PAIRING_DIR = './nexstore/pairing/';
const startpairing = require('./pair');
const { startPanelServer } = require('./panel-server');
const PANEL_MODE = process.env.ELARA_PANEL_MODE === 'true';
startPanelServer();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeProvider(value) {
    const provider = String(value || '').trim().toLowerCase();
    return ['whatsapp', 'telegram', 'both'].includes(provider) ? provider : '';
}

function askQuestion(rl, prompt, masked = false) {
    if (!masked) return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
    return new Promise(resolve => {
        const originalWriter = rl._writeToOutput;
        rl._writeToOutput = (text) => {
            if (text.includes(prompt)) rl.output.write(prompt);
            else rl.output.write('*');
        };
        rl.question(prompt, answer => {
            rl._writeToOutput = originalWriter;
            rl.output.write('\\n');
            resolve(answer.trim());
        });
    });
}

async function validateTelegramSetup(token) {
    const headers = { accept: 'application/json' };
    const meResponse = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, { headers });
    const me = await meResponse.json();
    if (!me.ok) throw new Error('Telegram token was rejected by Telegram.');
    const chatResponse = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getChat?chat_id=${encodeURIComponent(TELEGRAM_OFFICIAL_CHANNEL)}`, { headers });
    const chat = await chatResponse.json();
    if (!chat.ok) throw new Error(`The official channel ${TELEGRAM_OFFICIAL_CHANNEL} could not be reached by this token.`);
    return { username: me.result?.username || 'unknown', channelTitle: chat.result?.title || TELEGRAM_OFFICIAL_CHANNEL };
}

async function configureStartupProvider() {
    activeProvider = normalizeProvider(activeProvider || process.env.ELARA_PROVIDER);
    const hasWhatsApp = Boolean(HOSTED_WHATSAPP_NUMBER);
    const hasTelegram = Boolean(process.env.BOT_TOKEN || localToken.BOT_TOKEN);
    if (PANEL_MODE && !hasWhatsApp && !hasTelegram && !isAuthenticated() && !activeProvider) {
        activeProvider = 'panel';
        console.log(chalk.cyan('🌐 Panel-only mode active; choose WhatsApp or Telegram from the Elara Connect page.'));
        return activeProvider;
    }
    if (activeProvider) {
        if ((activeProvider === 'whatsapp' || activeProvider === 'both') && !hasWhatsApp && !process.stdin.isTTY) {
            throw new Error(`${activeProvider} mode requires WHATSAPP_NUMBER in a non-interactive deployment.`);
        }
        if ((activeProvider === 'telegram' || activeProvider === 'both') && !hasTelegram && !process.stdin.isTTY) {
            throw new Error(`${activeProvider} mode requires BOT_TOKEN in a non-interactive deployment.`);
        }
        if (activeProvider === 'telegram' || activeProvider === 'both') {
            const telegram = await validateTelegramSetup(process.env.BOT_TOKEN || localToken.BOT_TOKEN);
            console.log(chalk.green(`✅ Telegram credential verified as @${telegram.username}; official channel reachable: ${telegram.channelTitle}.`));
        }
        return activeProvider;
    }
    if (hasWhatsApp || hasTelegram || isAuthenticated()) {
        if (hasWhatsApp && hasTelegram) activeProvider = 'both';
        else if (hasWhatsApp) activeProvider = 'whatsapp';
        else if (hasTelegram) activeProvider = 'telegram';
        else activeProvider = 'whatsapp';
        return activeProvider;
    }
    if (!process.stdin.isTTY) {
        throw new Error('Fresh non-interactive deployments require ELARA_PROVIDER plus WHATSAPP_NUMBER or BOT_TOKEN.');
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(chalk.cyan('\\n🌹 Elara first-start connection setup'));
    console.log(chalk.white('1) WhatsApp — enter a phone number and receive a WhatsApp pairing code'));
    console.log(chalk.white('2) Telegram — enter a Telegram bot token and verify the official channel'));
    let choice = await askQuestion(rl, chalk.green('Choose 1 or 2: '));
    while (!['1', '2'].includes(choice)) choice = await askQuestion(rl, chalk.green('Please choose 1 for WhatsApp or 2 for Telegram: '));

    if (choice === '1') {
        const number = (await askQuestion(rl, chalk.green('WhatsApp phone number with country code: '))).replace(/[^0-9]/g, '');
        if (!/^\d{7,15}$/.test(number)) {
            rl.close();
            throw new Error('Invalid WhatsApp number. Include the country code and digits only.');
        }
        process.env.WHATSAPP_NUMBER = number;
        HOSTED_WHATSAPP_NUMBER = number;
        activeProvider = 'whatsapp';
        rl.close();
        console.log(chalk.yellow(`\\n📱 Requesting a WhatsApp pairing code for ${number}...`));
        console.log(chalk.green('✅ The normal WhatsApp loader will request the code once, then Elara will continue into normal logic.'));
        return activeProvider;
    }

    const token = await askQuestion(rl, chalk.green('Telegram bot token: '), true);
    rl.close();
    if (!token) throw new Error('Telegram bot token cannot be empty.');
    const telegram = await validateTelegramSetup(token);
    process.env.BOT_TOKEN = token;
    activeProvider = 'telegram';
    console.log(chalk.green(`✅ Telegram connected as @${telegram.username}. Official channel verified: ${telegram.channelTitle}.`));
    console.log(chalk.yellow('ℹ️ Regular users must join @elarapairgc before using commands.'));
    return activeProvider;
}

function isAuthenticated() {
    return fs.existsSync(AUTH_FILE) && JSON.parse(fs.readFileSync(AUTH_FILE)).authenticated;
}

function setAuthenticated(value) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ authenticated: value }));
}

const autoLoadPairs = async () => {
    if (activeProvider === 'telegram') {
        console.log(chalk.blue('ℹ️ Telegram-only mode selected; skipping WhatsApp session loading.'));
        return;
    }
    console.log(chalk.cyan('🔄 Auto-loading all paired users...'));
    
    if (!fs.existsSync(PAIRING_DIR)) {
        fs.mkdirSync(PAIRING_DIR, { recursive: true });
    }

    const pairedUsers = fs.readdirSync(PAIRING_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => /^\d{7,15}$/.test(name) || name.endsWith('@s.whatsapp.net'));

    if (pairedUsers.length === 0) {
        if (HOSTED_WHATSAPP_NUMBER) {
            console.log(chalk.yellow(`ℹ️ No paired WhatsApp session found. Requesting a pairing code for ${HOSTED_WHATSAPP_NUMBER}...`));
            await startpairing(HOSTED_WHATSAPP_NUMBER);
            console.log(chalk.green('📱 Pairing code requested. Enter the code shown in the Render logs on the target WhatsApp phone.'));
        } else {
            console.log(chalk.yellow('ℹ️ No paired users found. Set WHATSAPP_NUMBER on the host to request first-run pairing.'));
        }
        return;
    }

    console.log(chalk.green(`✅ Found ${pairedUsers.length} paired users. Starting connections...`));
    console.log(chalk.blue('⏳ Waiting 4 seconds before starting connections...'));
    await delay(4000);

    for (let i = 0; i < pairedUsers.length; i++) {
        const userNumber = pairedUsers[i];
        
        try {
            console.log(chalk.blue(`🔄 Connecting user ${i + 1}/${pairedUsers.length}: ${userNumber}`));
            await startpairing(userNumber);
            console.log(chalk.green(`✅ Connected successfully: ${userNumber}`));
            
            if (i < pairedUsers.length - 1) {
                console.log(chalk.blue('⏳ Waiting 4 seconds before next connection...'));
                await delay(4000);
            }
        } catch (error) {
            console.log(chalk.red(`❌ Failed for ${userNumber}: ${error.message}`));
            
            if (i < pairedUsers.length - 1) {
                console.log(chalk.blue('⏳ Waiting 4 seconds before retry...'));
                await delay(4000);
            }
        }
    }

    console.log(chalk.green('✅ All paired users processed.'));
    console.log(chalk.blue('⏳ Waiting 4 seconds before continuing...'));
    await delay(4000);
};

const initializeBot = async () => {
    console.clear();
    console.log(chalk.cyan(figlet.textSync('ELARA BOT ACTIVE', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    })));
    
    console.log(chalk.yellow('\n⚄︎══════════════════════⚄︎'));
    console.log(chalk.green('Elara v1'));
    console.log(chalk.yellow('⚄︎═════════════════════⚄︎\n'));

    await configureStartupProvider();
    await autoLoadPairs();

    if (isAuthenticated() || AUTO_START || activeProvider) {
        console.log(chalk.green('✅ Welcome back! Skipping password...'));
        launchBot();
    } else {
        if (!process.stdin.isTTY) {
            console.log(chalk.red('❌ Non-interactive deployment requires STARTUP_PASSWORD or ELARA_AUTO_START=true.'));
            process.exit(1);
        }
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.stdoutMuted = true;
        console.log(chalk.bold.yellow('🔐 Enter password to start bot:'));

        rl.question(chalk.green('Password: '), function (input) {
            if (input !== startupPassword) {
                console.log(chalk.red('\n❌ Incorrect password. Exiting...'));
                process.exit(1);
            }

            console.log(chalk.green('\n✅ Password correct. Starting bot system...'));
            setAuthenticated(true);
            rl.close();
            launchBot();
        });

        rl._writeToOutput = function _writeToOutput(stringToWrite) {
            if (rl.stdoutMuted) {
                rl.output.write(chalk.cyan('*'));
            } else {
                rl.output.write(stringToWrite);
            }
        };
    }
};

function launchBot() {
    console.clear();
    console.log(chalk.green('Elara is starting....\n'));

    let telegramLoaded = false;
    let whatsappLoaded = false;

    // Load Telegram bot (bot.js) only when Telegram was selected/configured.
    const botPath = path.join(__dirname, 'bot.js');
    if (activeProvider === 'telegram' || activeProvider === 'both') {
    if (fs.existsSync(botPath)) {
        try {
            console.log(chalk.blue('📱 Loading Telegram pairing system...'));
            require('./bot');
            telegramLoaded = true;
            console.log(chalk.green('✅ Elara ᴀᴄᴛɪᴠᴇ'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to load Telegram bot (bot.js):'));
            console.log(chalk.red('   Error:', error.message));
            
            if (error.stack) {
                console.log(chalk.gray('   Stack:', error.stack.split('\n')[1].trim()));
            }
            
            console.log(chalk.yellow('⚠️  Continuing without Telegram bot...\n'));
        }
    } else {
        console.log(chalk.yellow('⚠️  bot.js not found, skipping Telegram bot...\\n'));
    }
    } else {
        console.log(chalk.blue('ℹ️ Telegram was not selected; skipping Telegram polling.'));
    }

    // Load WhatsApp commands (case.js) when WhatsApp was selected/configured.
    const nexusPath = path.join(__dirname, 'case.js');
    if (activeProvider === 'whatsapp' || activeProvider === 'both') {
    if (fs.existsSync(nexusPath)) {
        try {
            console.log(chalk.blue('💬 Loading WhatsApp commands system...'));
            const nexusModule = require('./case');
            whatsappLoaded = true;
            console.log(chalk.green('✅ WhatsApp commands loaded successfully!'));
            
            // Note: Event listeners will be set up when pair.js creates the connection
            // We're just loading the command handler here
            
        } catch (error) {
            console.log(chalk.red('❌ Failed to load WhatsApp commands (case.js):'));
            console.log(chalk.red('   Error:', error.message));
            
            if (error.stack) {
                console.log(chalk.gray('   Stack:', error.stack.split('\n')[1].trim()));
            }
            
            console.log(chalk.yellow('⚠️  Continuing without WhatsApp commands...\n'));
        }
    } else {
        console.log(chalk.yellow('⚠️  case.js not found, skipping WhatsApp commands...\\n'));
    }
    } else {
        console.log(chalk.blue('ℹ️ WhatsApp was not selected; skipping WhatsApp command loader.'));
    }

    // Summary
    console.log(chalk.cyan('\n⚄︎═══════════════════════════════⚄︎'));
    console.log(chalk.bold.white('  ʙᴏᴛ ɪɴɪᴛɪᴀʟɪᴢᴀᴛɪᴏɴ sᴜᴍᴍᴀʀʀʏ        '));
    console.log(chalk.cyan('⚄︎════════════════════════════════⚄︎'));
    console.log(telegramLoaded ? chalk.green( 'Elara : ᴀᴄᴛɪᴠᴇ ✅') : chalk.red('❌ Elara'));
    console.log(whatsappLoaded ? chalk.green('✅ ᴡʜᴀᴛsᴀᴘᴘ ᴄᴏᴍᴍᴀɴᴅs: ᴀᴄᴛɪᴠᴇ') : chalk.red('❌ ᴡʜᴀᴛsᴀᴘᴘ ᴄᴏᴍᴍᴀᴍᴅs : ɪɴᴀᴄʏɪᴠᴇ'));
    console.log(chalk.cyan('⚄︎════════════════════════════════⚄︎\n'));

    if (activeProvider === 'panel') {
        console.log(chalk.green('🌐 Elara Connect panel is active; start a WhatsApp or Telegram session from the browser.\\n'));
    } else if (!telegramLoaded && !whatsappLoaded) {
        console.log(chalk.red('⚠️  Warning: No bot systems loaded! Check your files.\\n'));
    } else {
        console.log(chalk.green('✅ Elara is ᴀᴄᴛɪᴠᴇ!\\n'));
    }

    // Error handlers
    const ignoredErrors = [
        'Socket connection timeout',
        'EKEYTYPE',
        'item-not-found',
        'rate-overlimit',
        'Connection Closed',
        'Timed Out',
        'Value not found'
    ];

    process.on('unhandledRejection', (reason, promise) => {
        if (ignoredErrors.some(e => String(reason).includes(e))) return;
        
        console.log(chalk.red('\n⚠️  Unhandled Promise Rejection:'));
        console.log(chalk.yellow('Reason:'), reason);
    });

    process.on('uncaughtException', (error) => {
        if (ignoredErrors.some(e => String(error).includes(e))) return;
        
        console.log(chalk.red('\n❌ Uncaught Exception:'));
        console.log(chalk.yellow('Error:'), error.message);
        if (error.stack) {
            console.log(chalk.gray(error.stack));
        }
    });

    const originalConsoleError = console.error;
    console.error = function (message, ...optionalParams) {
        if (typeof message === 'string' && ignoredErrors.some(e => message.includes(e))) {
            return;
        }
        originalConsoleError.apply(console, [message, ...optionalParams]);
    };

    const originalStderrWrite = process.stderr.write;
    process.stderr.write = function (message, encoding, fd) {
        if (typeof message === 'string' && ignoredErrors.some(e => message.includes(e))) {
            return;
        }
        originalStderrWrite.apply(process.stderr, arguments);
    };

    console.log(chalk.blue('📊 Bot monitoring active...'));
    console.log(chalk.gray('Press Ctrl+C to stop the bot\n'));
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠️  Shutting down gracefully...'));
    console.log(chalk.green('👋 Goodbye!'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n\n⚠️  Received termination signal...'));
    process.exit(0);
});

initializeBot().catch((error) => {
    console.log(chalk.red('\n❌ Fatal error during initialization:'));
    console.log(chalk.yellow('Error:'), error.message);
    if (error.stack) {
        console.log(chalk.gray(error.stack));
    }
    process.exit(1);
});
