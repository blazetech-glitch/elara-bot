const fs = require('fs')

global.owner = "255627417402" //owner number
global.footer = "ARNOLDT20" //footer section
global.status = false //"self/public" section of the bot
global.prefa = ['','!','.',',','🐤','🗿']
global.owner = ['255627417402']
global.xprefix = '.'
global.gambar = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/zmQIDKfnOheZyGkQ.jpeg"
global.OWNER_NAME = "ARNOLDT20" //
global.DEVELOPER = ["255627417402"] //
global.BOT_NAME = "Elara"
global.bankowner = "ARNOLDT20"
global.creatorName = "ARNOLDT20"
global.ownernumber = '255627417402'  //creator number
global.location = "Nigeria,kwara"
global.prefa = ['','!','.','#','&']
//================DO NOT CHANGE OR YOU'LL GET AN ERROR=============\
global.footer = "Elara" //footer section
global.link = "https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E"
global.autobio = true//auto update bio
global.botName = "Elara"
global.version = "1.0.1"
global.botname = "Elara"
global.author = "ARNOLDT20"
global.themeemoji = "🥷"
global.wagc = 'https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E'
global.thumbnail = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/zmQIDKfnOheZyGkQ.jpeg'
global.richpp = ' '
global.packname = "Sticker By Elara"
global.author = "ARNOLDT20"
global.creator = "255627417402@s.whatsapp.net"
global.ownername = 'ARNOLDT20'
global.onlyowner = `Only ARNOLDT20 can use this Command 💜`
  // reply 
global.database = `*To Exist In The Database Contact The Owner of this bot*`
  global.mess = {
wait: "*Configurating.......*",
   success: "*Successfully acknowledged ☑️*",
   on: "*Activated ✅*", 
   prem: "*Feature For Premium Users only*", 
   off: "*Deactivated 📛*",
   query: {
       text: "*Please, Provide A Text Query 📑*",
       link: "Please, provide a valid link 🔗*",
   },
   error: {
       fitur: "*Status 🌐: Feature Or Command error ❌*",
   },
   only: {
       group: "*Group only feature ❌*",
private: "*Private chat feature only ❌*",
       owner: "*Owner feature only ❌*",
       admin: "*bot owner feature only ❌*",
       badmin: "*Seek admin privilege's to use this command ❌*",
       premium: "*Availabe for premium users only ❌*",
   }
}

global.hituet = 0
//false=disable and true=enable
global.autoviewstatus = false
global.autoread = false //auto read messages
global.autobio = true //auto update bio
global.anti92 = true //auto block +92 
global.autoswview = true //auto view status/story

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})

// Elara project configuration
//owner number:255627417402
//telegram owner: ARNOLDT20
