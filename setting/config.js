const fs = require('fs')

global.owner = "234" //owner number
global.footer = "Mrdev" //footer section
global.status = false //"self/public" section of the bot
global.prefa = ['','!','.',',','🐤','🗿']
global.owner = ['62']
global.xprefix = '.'
global.gambar = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/zmQIDKfnOheZyGkQ.jpeg"
global.OWNER_NAME = "@Mrddev" //
global.DEVELOPER = ["233266309343"] //
global.BOT_NAME = "elara"
global.bankowner = "Mrdev"
global.creatorName = "Mrdev"
global.ownernumber = '233266309343'  //creator number
global.location = "Nigeria,kwara"
global.prefa = ['','!','.','#','&']
//================DO NOT CHANGE OR YOU'LL GET AN ERROR=============\
global.footer = "elara" //footer section
global.link = "https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E"
global.autobio = true//auto update bio
global.botName = "elara"
global.version = "1.0.1"
global.botname = "elara"
global.author = "Mrdev "
global.themeemoji = "🥷"
global.wagc = 'https://whatsapp.com/channel/0029Vb6poDc3QxS2L0dxSq3E'
global.thumbnail = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894798070/zmQIDKfnOheZyGkQ.jpeg'
global.richpp = ' '
global.packname = "Sticker By elara"
global.author = "Mrdev "
global.creator = "233266309343@s.whatsapp.net"
global.ownername = 'Mrdev ' 
global.onlyowner = `Only Mrdev  can use this Command 💜🥷`
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

//Property of Kallmetrust  
//owner number:+234902009026
//telegram :@Rfxdx
