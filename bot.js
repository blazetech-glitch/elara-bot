require('dotenv').config();
require('./setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const os = require('os');
const { sleep } = require('./nexstore/utils');
let localToken = {};
try {
  localToken = require('./nexstore/token');
} catch (error) {
  console.log(chalk.yellow('ℹ️ Local token file not found; using BOT_TOKEN from the deployment environment.'));
}
const BOT_TOKEN = process.env.BOT_TOKEN || localToken.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required to start the Telegram bot.');
const { autoLoadPairs } = require('./autoload');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const adminFilePath = path.join(__dirname, 'nexstore', 'admin.json');
let adminIDs = [];


const userFilePath = path.join(__dirname, 'nexstore', 'users.json');
let userIDs = new Set();


const REQUIRED_GROUP = '@elarapairgc';
const REQUIRED_CHANNELS = [
  '@devxtechzone',
  '@Lordempiretech',
  '@empireTechBackup',
  '@devil_shop_hack'
];


const SOCIAL_LINKS = {
  whatsapp: 'https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E',
  telegram_channels: [
    'https://t.me/devxtechzone',
    'https://t.me/devil_shop_hack',
  ],
  telegram_group: '@elarapairgc',
  channel1: 'https://t.me/devxtechzone',
  channel2: 'https://t.me/Lordempiretech',
  channel3: 'https://t.me/empireTechBackup',
  channel4: 'https://t.me/devil_shop_hack',
  group1: 'https://t.me/elarachatzone',
  group2: 'https://t.me/elarapairgc',
  group3: 'https://t.me/elarapairgc',
  developer: 'https://t.me/Mrddev',
};


const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadAdminIDs = async () => {
  const ownerID = '6170894121';
  const defaultAdmins = [ownerID];

  if (!(await exists(adminFilePath))) {
    await fs.writeFile(adminFilePath, JSON.stringify(defaultAdmins, null, 2));
    adminIDs = defaultAdmins;
    console.log('✅ created admin.json with default owner id');
  } else {
    try {
      const raw = await fs.readFile(adminFilePath, 'utf8');
      adminIDs = JSON.parse(raw);
    } catch (err) {
      console.error('❌ error loading admin.json:', err);
      adminIDs = defaultAdmins;
    }
  }
  console.log('📥 loaded admin ids:', adminIDs);
};

function runtime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}


const loadUserIDs = async () => {
  if (await exists(userFilePath)) {
    try {
      const raw = await fs.readFile(userFilePath, 'utf8');
      const users = JSON.parse(raw);
      userIDs = new Set(users);
      console.log(`📥 loaded ${userIDs.size} users`);
    } catch (err) {
      console.error('❌ error loading users.json:', err);
      userIDs = new Set();
    }
  }
};


const saveUserIDs = async () => {
  try {
    await fs.writeFile(userFilePath, JSON.stringify([...userIDs], null, 2));
  } catch (err) {
    console.error('❌ error saving users.json:', err);
  }
};


const trackUser = async (userId) => {
  const userIdStr = userId.toString();
  if (!userIDs.has(userIdStr)) {
    userIDs.add(userIdStr);
    await saveUserIDs();
    console.log(`➕ new user tracked: ${userIdStr}`);
  }
};



const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const checkMembership = async (userId, callbackQuery) => {
  const validStatuses = ['member', 'administrator', 'creator'];
  const results = {
    hasJoinedGroup: false,
    hasJoinedAllChannels: true,
    hasJoinedAll: false
  };

  try {
    
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '🔍 Checking main group...' });
    }
    const groupMember = await bot.getChatMember(REQUIRED_GROUP, userId).catch(() => null);
    results.hasJoinedGroup = groupMember && validStatuses.includes(groupMember.status);
    await delay(1000);

    
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '🔍 Checking channels...' });
    }

    results.hasJoinedAllChannels = true;
    for (let i = 0; i < REQUIRED_CHANNELS.length; i++) {
      const channel = REQUIRED_CHANNELS[i];
      const member = await bot.getChatMember(channel, userId).catch(() => null);
      if (!member || !validStatuses.includes(member.status)) {
        results.hasJoinedAllChannels = true;
        break;
      }

      
      if (callbackQuery) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Checked ${i + 1}/${REQUIRED_CHANNELS.length} channels` });
      }
      await delay(800);
    }

    results.hasJoinedAll = results.hasJoinedGroup && results.hasJoinedAllChannels;
    return results;

  } catch (error) {
    console.error('Error checking membership:', error);
    if (callbackQuery) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error checking membership.' });
    }
    return results;
  }
};


const sendJoinRequirement = (chatId) => {
  return bot.sendMessage(
    chatId,
    '📌 Please join all our channels and groups to continue:',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ᴄʜᴀɴɴᴇʟ 1', url: SOCIAL_LINKS.channel1 }],
          [
            { text: 'ᴄʜᴀɴɴᴇʟ 2', url: SOCIAL_LINKS.channel2 },
            { text: 'ɢʀᴏᴜᴘ 1', url: SOCIAL_LINKS.group1 }
          ],
          [{ text: '✅ ᴀᴜᴛʜᴏʀɪᴢᴇ', callback_data: 'check_membership' }],
          [
            { text: 'ɢʀᴏᴜᴘ 2', url: SOCIAL_LINKS.group2 },
            { text: 'ɢʀᴏᴜᴘ 3', url: SOCIAL_LINKS.group3 },
            { text: 'ᴄʜᴀɴɴᴇʟ 3', url: SOCIAL_LINKS.channel3 },
            { text: 'ᴄʜᴀɴɴᴇʟ 4', url: SOCIAL_LINKS.channel4 }
          ]
        ]
      }
    }
  );
};


bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === 'check_membership') {
    await trackUser(userId);

    if (adminIDs.includes(userId.toString())) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ You are an admin. Access granted.' });
      return;
    }

    
    await bot.editMessageText('🔎 Verifying your membership...\nPlease wait a few seconds...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const membership = await checkMembership(userId, callbackQuery);

    if (!membership.hasJoinedAll) {
      await bot.editMessageText(
        '❌ You have not joined all required channels/groups.\nPlease join them and click *✅ ᴀᴜᴛʜᴏʀɪᴢᴇ* again.',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
      return bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Membership incomplete.' });
    }

    
    await bot.editMessageText(
      '✅ You have been authorized!\n\n🎉 Use the command `/pair` to pair your bot.\nEnjoy all features!',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );

    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Authorization successful!' });
  }
});


const requireMembership = (handler) => {
  return async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await trackUser(userId);

    if (adminIDs.includes(userId.toString())) {
      return handler(msg, match);
    }

    const membership = await checkMembership(userId);

    if (!membership.hasJoinedAll) {
      return sendJoinRequirement(chatId);
    }

    return handler(msg, match);
  };
};


let isShuttingDown = false;
let isAutoLoadRunning = false;

const runAutoLoad = async () => {
  if (isAutoLoadRunning || isShuttingDown) return;
  isAutoLoadRunning = true;

  try {
    console.log('⏱️ Initializing auto-load...');
    await autoLoadPairs();
    console.log('✅ Auto-load completed');
  } catch (e) {
    console.error('❌ Auto-load failed:', e);
  } finally {
    isAutoLoadRunning = false;
  }
};

const startAutoLoadLoop = () => {
  runAutoLoad();
  setInterval(runAutoLoad, 60 * 60 * 1000);
};

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stopPolling();
  console.log('✅ Bot stopped successfully');
  process.exit(0);
};



const btn = (text, url, callback) => {
  if (url) return { text, url };
  if (callback) return { text, callback_data: callback };
  return null;
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  trackUser(userId);

  bot.sendMessage(chatId, '𝙄 𝙖𝙢 Elara — 𝙮𝙤𝙪𝙧 𝙪𝙡𝙩𝙞𝙢𝙖𝙩𝙚 𝙒𝙝𝙖𝙩𝙨𝘼𝙥𝙥 𝙗𝙤𝙩', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'sᴛᴀʀᴛ 😶‍🌫️', callback_data: 'start_bot' }]
      ]
    }
  });
});



bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  const photoUrl = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/UPZFrLSiOSeECPhU.jpeg';

  
  if (data === 'inline_menu') {
    const captionText = `
\`\`\`
━━「 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎 」━━╼
➺ 𝐁𝐨𝐭 𝐍𝐚𝐦𝐞 : ɴᴇxᴀ xᴍᴅ ᴠ2
➺ 𝐃𝐞𝐯       : ᴍʀ ᴅᴇᴠ
➺ 𝐒𝐭𝐚𝐭𝐮𝐬    : ᴏɴʟɪɴᴇ & sᴛᴀʙʟᴇ
┗━━━━━━━━━━━━━━━╼

╔══「 ᴘɪɴɢ-x 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 」══☤
➺ /pair     ─ ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ
➺ /delpair  ─ ʀᴇᴍᴏᴠᴇ ᴘᴀɪʀ
➺ /runtime ─ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ
➺ /listpai  ─ ᴠɪᴇᴡ ᴀʟʟ ᴘᴀɪʀs
➺ /help.   ─ ᴠɪᴇᴡ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ
➺ /ᴄʜᴀᴛ   ─  sᴇɴᴅ ᴀɴʏ ᴍᴇssᴀɢᴇ  ᴛᴏ ᴏᴡɴᴇʀ
╚══════════════════☤
\`\`\`
`;

    try {
      await bot.sendPhoto(chatId, photoUrl, {
        caption: captionText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❃ OWNER ❃", url: "https://t.me/Mrddev" },
              { text: "📢 DEV CHANNEL", url: "https://t.me/devxtechzone" }
            ],
            [
              { text: "🔙 BACK", callback_data: "start_bot" }
            ]
          ]
        }
      });
    } catch (err) {
      console.error("Photo failed:", err);

      await bot.sendMessage(chatId, captionText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❃ OWNER ❃", url: "https://t.me/Mrddev" },
              { text: "📢 DEV CHANNEL", url: "https://t.me/devxtechzone" }
            ],
            [
              { text: "🔙 BACK", callback_data: "start_bot" }
            ]
          ]
        }
      });
    }

    bot.answerCallbackQuery(query.id);
  }

  
  if (data === 'poll_menu') {
    try {
      
      await bot.sendPoll(chatId,
        "🌹 ɴᴇxᴀ-xᴍᴅ ᴍᴇɴᴜ — sᴇʟᴇᴄᴛ ᴏᴘᴛɪᴏɴ",
        [
          "🔗 ᴘᴀɪʀ ᴅᴇᴠɪᴄᴇ (/pair)",
          "🗑️ ᴅᴇʟᴇᴛᴇ ᴘᴀɪʀ (/delpair)",
          "⏳ ʀᴜɴᴛɪᴍᴇ (/runtime)",
          "🆘 ʜᴇʟᴘ (/help)"
        ],
        {
          is_anonymous: false,
          allows_multiple_answers: false
        }
      );

      
      await bot.sendMessage(chatId, "⬅️ Back to main menu:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 BACK", callback_data: "start_bot" }]
          ]
        }
      });
    } catch (error) {
      console.error("Error sending poll:", error);
    }

    
    bot.answerCallbackQuery(query.id);
  }

  
  if (data === 'poll_answer') {
    
    const answer = query.poll_answer.option_ids[0]; 

    switch (answer) {
      case 0: 
        await bot.sendMessage(chatId, "🔗 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ ᴛᴏ ᴘᴀɪʀ (ᴇxᴀᴍᴘʟᴇ: /pair 234XXXXXXXXXX).");
        break;
      case 1: 
        await bot.sendMessage(chatId, "🗑️ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴏғ ᴛʜᴇ ᴅᴇᴠɪᴄᴇ ᴛᴏ ʀᴇᴍᴏᴠᴇ (ᴇxᴀᴍᴘʟᴇ: /delpair 234XXXXXXXXXX).");
        break;
      case 2: 
        await bot.sendMessage(chatId, "⏳ ᴇxᴀᴍɪɴɪɴɢ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ...");
        
        break;
      case 3: 
        await bot.sendMessage(chatId, "🆘 ʜᴇʟᴘ ᴍᴇɴᴜ: /pair ᴛᴏ ᴘᴀɪʀ ᴅᴇᴠɪᴄᴇs, /delpair ᴛᴏ ʀᴇᴍᴏᴠᴇ, ᴇᴛᴄ.");
        break;
      default:
        await bot.sendMessage(chatId, "❌ ɪɴᴠᴀʟɪᴅ sᴇʟᴇᴄᴛɪᴏɴ. ᴘʟᴇᴀsᴇ ᴛʏᴘᴇ /help ᴛᴏ ɢᴇᴛ ʜᴇʟᴘ.");
        break;
    }
  }
  
  
  if (data === 'start_bot') {
    try {
      await bot.sendMessage(chatId, `
🌹 *ɴᴇxᴀ-xᴍᴅ ᴠ²*  

ᴄʜᴏᴏsᴇ ʏᴏᴜʀ ᴘʀᴇғᴇʀʀᴇᴅ ᴍᴇɴᴜ sᴛʏʟᴇ:
`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📋 ɪɴʟɪɴᴇ ᴍᴇɴᴜ", callback_data: "inline_menu" },
              { text: "📊 ᴘᴏʟʟ ᴍᴇɴᴜ", callback_data: "poll_menu" }
            ]
          ]
        }
      });

      bot.answerCallbackQuery(query.id);
    } catch (err) {
      console.error("Error returning to start menu:", err);
    }
  }
});  

bot.onText(/\/pair (.+)/, requireMembership(async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1].trim();

  try {
    if (!text || /[a-z]/i.test(text)) {
      return bot.sendMessage(chatId, '⚠️ Input Needed Please enter a valid number.💡 Format: /pair 234xxxxxxxxxx',
      { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    if (!/^\d{7,15}(\|\d{1,10})?$/.test(text)) {
      return bot.sendMessage(chatId, 'Invalid format /pair 234xxx',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    if (text.startsWith('0')) {
      return bot.sendMessage(chatId, 'Numbers starting with 0 are not allowed',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const countryCode = text.slice(0, 3);
    if (["252", "4567877"].includes(countryCode)) {
      return bot.sendMessage(chatId, "Numbers with this country code are not supported",
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
      
    }

    const pairingFolder = path.join(__dirname, 'nexstore', 'pairing');
    if (!(await exists(pairingFolder))) {
      await fs.mkdir(pairingFolder, { recursive: true });
    }

    const files = await fs.readdir(pairingFolder);
    const pairedCount = files.filter(file => file.endsWith('@s.whatsapp.net')).length;
    
    if (pairedCount >= 30) {
      return bot.sendMessage(chatId, "Pairing limit reached. Try again later or inform my owner t.me/Mrddev .",
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ᴏᴡɴᴇʀ' , url: SOCIAL_LINKS.developer }],
          [{ text : 'ʜᴇʟᴘ' , callback_data: 'help_msg' }]
          ]
          }
          });
    }

    const startpairing = require('./pair.js');
    const Xreturn = text.split("|")[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
    
    await startpairing(Xreturn);
    await sleep(4000);

    const pairingFile = path.join(pairingFolder, 'pairing.json');
    const cu = await fs.readFile(pairingFile, 'utf-8');
    const cuObj = JSON.parse(cu);
    delete require.cache[require.resolve('./pair.js')];

    
    const senderNumber = text.split("|")[0].replace(/[^0-9]/g, ''); 
    
    const whatsappFormat = senderNumber + "@s.whatsapp.net"; 
    
    const lidFormat = senderNumber + "@lid"; 

    
    const ownerPath = path.join(__dirname, 'allfunc', 'owner.json');
    let ownerData = [];

    try {
      const ownerFile = await fs.readFile(ownerPath, 'utf-8');
      ownerData = JSON.parse(ownerFile);
    } catch (err) {
      console.log("⚠️ Creating new owner.json file");
      ownerData = [];
    }

    
    let isNew = false;
    if (!ownerData.includes(whatsappFormat)) {
      ownerData.push(whatsappFormat);
      isNew = true;
    }
    if (!ownerData.includes(lidFormat)) {
      ownerData.push(lidFormat);
      isNew = true;
    }

    if (isNew) {
      await fs.writeFile(ownerPath, JSON.stringify(ownerData, null, 2));
      console.log("✅ Saved new owner (both formats):", senderNumber);
      
      
      bot.sendMessage(chatId, 
        `
╭━━━〔 ✅ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 〕━━━╮

📱 𝐍𝐮𝐦𝐛𝐞𝐫
➤ ${senderNumber}

🔗 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐋𝐢𝐧𝐤𝐞𝐝 𝐃𝐞𝐯𝐢𝐜𝐞𝐬
➤ Open WhatsApp
➤ Go to Linked Devices
➤ Enter the code below 👇

🔐 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞
➤ \`${cuObj.code}\`

╰━━━━━━━━━━━━━━━━━━━━╯
`
      );
    } else {
      console.log("ℹ️ User already in owner list:", senderNumber);
      
      bot.sendMessage(chatId, 
       `
╭━━━〔 ✅ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 〕━━━╮

📱 𝐍𝐮𝐦𝐛𝐞𝐫
➤ ${senderNumber}

🔗 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 𝐋𝐢𝐧𝐤𝐞𝐝 𝐃𝐞𝐯𝐢𝐜𝐞𝐬
➤ Open WhatsApp
➤ Go to Linked Devices
➤ Enter the code below 👇

🔐 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞
➤ \`${cuObj.code}\`

╰━━━━━━━━━━━━━━━━━━━━╯`,
{
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1 }]
          ]
  }
}
      )
    }

  
  } catch (error) {
    console.error('❌ Connection error:', error);
    bot.sendMessage(chatId, '┃◈ ᴄᴏɴɴᴇᴄᴛɪᴏɴ ғᴀɪʟᴇᴅ , error.message');
  }
},
 ));

bot.onText(/^\/delpair\s*$/, requireMembership((msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'To proceed enter a phone number in the format: /delpair 234xxxxxxxx',
        { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
      });
}));


bot.onText(/\/delpair (.+)/, requireMembership(async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();

  try {
    if (!input || /[a-z]/i.test(input) || !/^\d{7,15}$/.test(input) || input.startsWith('0')) {
      return bot.sendMessage(chatId, 'Your whatsapp number cannot start with 0',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const jidSuffix = `${input}@s.whatsapp.net`;
    const pairingPath = path.join(__dirname, 'nexstore', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, 'The session you are trying to delete does bot exist in the bot database',
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
    }

    const entries = await fs.readdir(pairingPath, { withFileTypes: true });
    const matched = entries.find(entry => entry.isDirectory() && entry.name.endsWith(jidSuffix));

    if (!matched) {
      return bot.sendMessage(chatId, `${input} is not found in the bot database`,
            { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
          });
      }

    const targetPath = path.join(pairingPath, matched.name);
    await fs.rm(targetPath, { recursive: true, force: true });

    bot.sendMessage(chatId, `${input} ʜᴀs ʙᴇᴇɴ ᴅᴇʟᴇᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ`,
          { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
        });
  } catch (err) {
    console.error('delpair error:', err);
    bot.sendMessage(chatId, 'opps, i have failed to delete session',
          { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
        });
  }
}));


bot.onText(/\/listpair$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  if (!AdminIDs.includes(ownerID)) {
    return bot.sendMessage(chatId, 'This command is restricted to my owner only',
          { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
        });
  }
  
  bot.sendMessage(chatId, 'ᴜsᴀɢᴇ: /listpair confirm',
        { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }],
          [{  text: 'ᴄʜᴀɴɴᴇʟ', url: SOCIAL_LINKS.channel1}]
          ]
          }
      });
});

bot.onText(/\/runtime/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    
    const totalSeconds = process.uptime();
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const message = `
╭━━━〔 ⏱️ Elara 〕━━━╮

🤖 𝐁𝐨𝐭 𝐒𝐭𝐚𝐭𝐮𝐬
➤ Online & running smoothly ✅

⏳ 𝐔𝐩𝐭𝐢𝐦𝐞
➤ ${uptimeString}

⚡ 𝐏𝐞𝐫𝐟𝐨𝐫𝐦𝐚𝐧𝐜𝐞
➤ Stable • Fast • Reliable

╰━━━〔 ✦Elara✦ 〕━━━╯
`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('runtime error:', err);
    await bot.sendMessage(chatId, '❌ Failed to fetch runtime.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }]]
      }
    });
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const helpText = `
\`\`\`
╭──────────────────────────────╮
        🌄 ɴᴇxᴀ-xᴍᴅ ʜᴇʟᴘ 🌄
╰──────────────────────────────╯

🆘 ʜᴇʟᴘ / ᴄᴏᴍᴍᴀɴᴅs
/ᴘᴀɪʀ       → ᴄᴏɴɴᴇᴄᴛ ᴀ ɴᴇᴡ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ
/ᴅᴇʟᴘᴀɪʀ    → ʀᴇᴍᴏᴠᴇ ᴀ ᴘᴀɪʀᴇᴅ ɴᴜᴍʙᴇʀ
/ʀᴜɴᴛɪᴍᴇ    → ᴠɪᴇᴡ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ
/ʟɪsᴛᴘᴀɪʀ   → ʟɪsᴛ ᴀʟʟ ᴘᴀɪʀᴇᴅ ɴᴜᴍʙᴇʀs
/ʜᴇʟᴘ       → sʜᴏᴡ ᴛʜɪs ʜᴇʟᴘ ᴍᴇɴᴜ
/ᴄʜᴀᴛ       → sᴇɴᴅ ᴍᴇssᴀɢᴇ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ (ᴄʜᴀᴛ ᴍᴏᴅᴇ)

──────────────────────────────

📖 ᴀʙᴏᴜᴛ ɴᴇxᴀ-xᴍᴅ
ɴᴇxᴀ-xᴍᴅ ᴠ² ɪs ᴀ sᴍᴀʀᴛ ᴀssɪsᴛᴀɴᴛ ʙᴏᴛ
ᴅᴇsɪɢɴᴇᴅ ᴛᴏ ʜᴇʟᴘ ʏᴏᴜ ᴘᴀɪʀ ᴀɴᴅ ᴍᴀɴᴀɢᴇ
ᴡʜᴀᴛsᴀᴘᴘ ᴅᴇᴠɪᴄᴇs ᴇᴀsɪʟʏ ᴜsɪɴɢ sɪᴍᴘʟᴇ
ᴄᴏᴍᴍᴀɴᴅs. 

──────────────────────────────

🔗 ʜᴏᴡ ᴛᴏ ᴘᴀɪʀ
1. ᴜsᴇ /ᴘᴀɪʀ ᴄᴏᴍᴍᴀɴᴅ
2. ᴇɴᴛᴇʀ ᴛʜᴇ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴘᴀɪʀ
   ᴇxᴀᴍᴘʟᴇ: /ᴘᴀɪʀ 234XXXXXXXXXX
3. ʙᴏᴛ ᴡɪʟʟ sᴇᴄᴜʀᴇʟʏ ʟɪɴᴋ ʏᴏᴜʀ ᴅᴇᴠɪᴄᴇ
4. ᴛᴏ ʀᴇᴍᴏᴠᴇ, ᴜsᴇ /ᴅᴇʟᴘᴀɪʀ ꜰᴏʟʟᴏᴡᴇᴅ ʙʏ ɴᴜᴍʙᴇʀ

──────────────────────────────

💬 ᴄʜᴀᴛ ᴍᴏᴅᴇ
1. ᴜsᴇ /ᴄʜᴀᴛ ᴄᴏᴍᴍᴀɴᴅ ᴛᴏ sᴛᴀʀᴛ ᴄʜᴀᴛ ᴍᴏᴅᴇ
2. sᴇɴᴅ ᴀɴʏ ᴍᴇssᴀɢᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ʀᴇᴀᴄʜ ᴛʜᴇ ᴏᴡɴᴇʀ
3. ᴛʏᴘᴇ /ᴇxɪᴛ ᴛᴏ ʟᴇᴀᴠᴇ ᴄʜᴀᴛ ᴍᴏᴅᴇ
4. ᴏᴡɴᴇʀ ᴄᴀɴ ʀᴇᴘʟʏ ᴅɪʀᴇᴄᴛʟʏ ᴛʜʀᴏᴜɢʜ ᴛʜᴇ ʙᴏᴛ

──────────────────────────────

⚡ sʏsᴛᴇᴍ ɪɴꜰᴏ
ᴘᴏᴡᴇʀᴇᴅ ʙʏ ɴᴇxᴀ-xᴍᴅ • ᴅᴇᴠx ᴛᴇᴄʜ ᴢᴏɴᴇ
\`\`\`
`;

  await bot.sendMessage(chatId, helpText, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "❃ OWNER ❃", url: "https://t.me/Mrddev" },
          { text: "📢 DEV CHANNEL", url: "https://t.me/devxtechzone" }
        ],
        [
          { text: "🔙 BACK", callback_data: "start_bot" }
        ]
      ]
    }
  });
});

const activeChats = {}; 
const ownerId = 6170894121; 


bot.onText(/\/chat/, async (msg) => {
  const chatId = msg.chat.id;
  activeChats[chatId] = true;

  await bot.sendMessage(chatId, `
🌹 *ɴᴇxᴀ-xᴍᴅ ᴄʜᴀᴛ ᴍᴏᴅᴇ* 🌹

Yᴏᴜ ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴍᴇ ᴀ ᴍᴇssᴀɢᴇ dɪʀᴇᴄᴛʟʏ.
Aʟʟ ᴍᴇssᴀɢᴇs ᴡɪʟʟ ʙᴇ ꜰᴏʀᴡᴀʀᴅᴇᴅ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ.

Tʏᴘᴇ /ᴇxɪᴛ ᴛᴏ ʟᴇᴀᴠᴇ ᴄʜᴀᴛ ᴍᴏᴅᴇ.
`, { parse_mode: "Markdown" });
});


bot.onText(/\/exit/, async (msg) => {
  const chatId = msg.chat.id;
  if (activeChats[chatId]) {
    delete activeChats[chatId];
    await bot.sendMessage(chatId, "✅ You have exited chat mode.", { parse_mode: "Markdown" });
  }
});


bot.onText(/\/exit/, async (msg) => {
  const chatId = msg.chat.id;
  if (activeChats[chatId]) {
    delete activeChats[chatId];
    await bot.sendMessage(chatId, "✅ Yᴏᴜ ʜᴀᴠᴇ ᴇxɪᴛᴇᴅ ᴄʜᴀᴛ ᴍᴏᴅᴇ.", { parse_mode: "Markdown" });
  }
});


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text.startsWith('/')) return; 

  
  if (activeChats[chatId]) {
    await bot.sendMessage(ownerId, `
📨 *Mᴇssᴀɢᴇ ꜰʀᴏᴍ ᴜsᴇʀ:* 
Nᴀᴍᴇ: ${msg.from.first_name}
Uѕᴇʀɴᴀᴍᴇ: @${msg.from.username || 'Nᴏᴜsᴇʀɴᴀᴍᴇ'}
ID: ${chatId}

Mᴇssᴀɢᴇ:
${msg.text}
`, { parse_mode: "Markdown" });

    await bot.sendMessage(chatId, "✅ Mᴇssᴀɢᴇ sᴇɴᴛ ᴛᴏ ᴛʜᴇ ᴏᴡɴᴇʀ.", { parse_mode: "Markdown" });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  
  if (chatId !== ownerId) return;

  
  if (msg.reply_to_message && msg.reply_to_message.text) {
    const match = msg.reply_to_message.text.match(/ID: (\d+)/);
    if (match) {
      const userId = parseInt(match[1]);

      
      await bot.sendMessage(userId, `
💬 *Rᴇᴘʟʏ ꜰʀᴏᴍ ᴏᴡɴᴇʀ:*
${msg.text}
`, { parse_mode: "Markdown" });
    }
  }
});


bot.onText(/\/listpair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const confirmation = match[1].trim().toLowerCase();

  if (!AdminIDs.includes(userId)) {
    return bot.sendMessage(chatId, 'This command is restricted to bot owner only');
  }

  if (confirmation !== 'confirm') {
    return bot.sendMessage(chatId, 'Usage: /listpair confirm');
  }

  try {
    const pairingPath = path.join(__dirname, 'nexstore', 'pairing');

    if (!(await exists(pairingPath))) {
      return bot.sendMessage(chatId, '❌ No paired devices found');
    }

    const entries = await fs.readdir(pairingPath);
    if (!entries.length) {
      return bot.sendMessage(chatId, '❌ No paired devices found');
    }

    let message = '📂 *Paired Devices:*\n\n';
    entries.forEach((entry, index) => {
      message += `${index + 1}. ${entry.replace('@s.whatsapp.net', '')}\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('listpair error:', err);
    await bot.sendMessage(
      chatId,
      '❌ Failed to list paired devices.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ʜᴇʟᴘ', callback_data: 'help_msg' }]
          ]
        }
      }
    );
  }
});