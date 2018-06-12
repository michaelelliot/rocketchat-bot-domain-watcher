require("dotenv").config()
const settings = require('./settings')
const Bot = require("rocketchat-bot").Bot
const dig = require("node-dig-dns")

let initialNSLookup = true
let initialMXLookup = true
let cachedNameServers = ['<first-time-lookup>']
let cachedMxServers = ['<first-time-lookup>']

function sendChannelMessage(msg) {
  bot.wsAPI.sendChatMessage(process.env.ROCKETCHAT_CHANNEL_ID, msg)
}

function checkDomain() {
  // Lookup domain's nameserver from root server
  dig([settings.domain, 'NS', '@a.gtld-servers.net'])
  .then((result) => {
    if (result.authority && Array.isArray(result.authority)) {
      let nameServers = []
      for(let entry of result.authority) {
        if (entry.length === 5 && entry[3] === 'NS') {
          let value = entry[4]
          if (value.substr(-1, 1) === '.') value = value.substr(0, value.length - 1)
          nameServers.push(value)
        }
      }
      nameServers.sort()
      if (nameServers.length > 0) console.log("Found name servers:", nameServers.join(" "))
      else console.log("No name servers found")
      if (nameServers.join(" ") !== cachedNameServers.join(" ")) {
        console.log("Nameservers different than cache")
        if (initialNSLookup) {
          console.log("Not sending alert because first time lookup")
          initialNSLookup = false
        } else {
          console.log("Alerting channel: Nameservers have changed")
          sendChannelMessage(`Nameservers for ${settings.domain} have changed from: ${cachedNameServers.join(" ")} to ${nameServers.join(" ")}`)
        }
        cachedNameServers = nameServers
      }
      console.log("Cached name servers:", cachedNameServers.join(" "))
    }
  })
  .catch(err => {
    console.error('Error:', err)
  })

  if (cachedNameServers.length > 0) {
    // Lookup domain's MX records from nameserver
    dig([settings.domain, 'MX', '@' + cachedNameServers[0]])
    .then((result) => {
      if (result.answer && Array.isArray(result.answer)) {
        let mxServers = []
        for(let entry of result.answer) {
          if (entry.type === 'MX') {
            let value = entry.value
            if (value.substr(-1, 1) === '.') value = value.substr(0, value.length - 1)
            mxServers.push(value)
          }
        }
        mxServers.sort()
        if (mxServers.length > 0) console.log("Found MX servers:", mxServers.join(" "))
        else console.log("No MX servers found")
        if (mxServers.join(" ") !== cachedMxServers.join(" ")) {
          console.log("MX servers different than cache")
          if (initialMXLookup) {
            console.log("Not sending alert because first time lookup")
            initialMXLookup = false
          } else {
            console.log("Alerting channel: MX servers have changed")
            sendChannelMessage(`MX records for ${settings.domain} have changed from: ${cachedMxServers.join(" ")} to ${mxServers.join(" ")}`)
          }
          cachedMxServers = mxServers
        }
        console.log("Cached MX servers:", cachedMxServers.join(" "))
      }
    })
    .catch(err => {
      console.error('Error:', err)
    })
  }
}

const bot = new Bot({
  server: process.env.ROCKETCHAT_SERVER,
  username: process.env.ROCKETCHAT_USERNAME,
  password: process.env.ROCKETCHAT_PASSWORD
})

bot.start()

bot.on("ready", () => {
  console.log("The bot is ready")
  console.log(`Checking for DNS changes to ${settings.domain} every ${settings.checkIntervalSecs} seconds`)
  checkDomain()
  setInterval(checkDomain, settings.checkIntervalSecs * 1000)
})

bot.on("message", (msg) => {
  console.log('Got message:', msg)
})

// Use this to find out a channel's id
bot.on("groupAdded", (group) => {
  console.log(`Found channel #${group.name} with id: ${group._id}`)
})

// setTimeout(() => { bot.wsAPI.sendChatMessage('group_id', 'test') }, 10000)
