#!/usr/bin/env node
const puppeteer = require("puppeteer")
const minimist = require("minimist")
const fs = require("fs")
const os = require("os")
const xlsx = require("xlsx")
const path = require("path")
const cp = require("child_process")

let args = minimist(process.argv)

if(args.playlist==undefined){
    console.log("Playlist name not entered.")
    process.exit()
}
let playlist = args.playlist

if(args.folderPath==undefined){
    var folderPath = path.join(os.homedir(),"Desktop")
}else{
    var folderPath = path.normalize(args.folderPath)
}

if(args.filename == undefined){
    console.log("Define a name for playlist")
    process.exit()
}

xlfile = args.filename


{(async ()=>{
    try{
        const browser = await puppeteer.launch({
            headless:false,
            args:["--start-maximized"],
            defaultViewport:null
        })
    
        const tab = await browser.newPage()
        await tab.goto(playlist)

        const title = await getTitle(tab)
        console.log("Title :",title)
        
        let fileName = xlfile+".xlsx"
        console.log("File Name :",fileName)

        let totalVids = await getNumberOfVideos(tab)
        console.log("Number of videos :",totalVids)

        let currVids =  await getCurrentNumOfVideos(tab)
        // console.log(currVids)
        
        let list = []
        while(true){
            await scrollToBottom(tab)
            list = await getStats(tab)
            if(totalVids == list.length) break;

            currVids = await getCurrentNumOfVideos(tab)
        }
        
        await browser.close()

        const filePath = path.join(folderPath,fileName)

        let totalDur = list.reduce((prev,ele)=>prev+ele.Duration,0)
        list.push({"Video Title" : "", "Duration":""})
        list.push({"Video Title" : "Total Time", "Duration":totalDur})

        writeExcel(filePath,list)

        console.log("File Path :",filePath)


    }catch(err){
        console.log(err)
    }

})()}

async function getTitle(tab){
    try{
        await tab.waitForSelector('h1#title')
        const title = await tab.evaluate(function(selector){
            return document.querySelector(selector).innerText
        },'h1#title')

        return title
    }catch(err){
        console.log(err)
    }
}

async function getNumberOfVideos(tab){
    try{
        await tab.waitForSelector('div#stats')
        const videos = (await tab.evaluate(function(selector){
            return document.querySelector(selector).innerText
        },"div#stats")).split(' ')[0]
        return videos
    }catch(err){
        console.log(err)
    }
}

async function getCurrentNumOfVideos(tab){
    try{
        const selector = "span#text"
        await tab.waitForSelector(selector)
        const videos = await tab.$$(selector)

        return videos.length

    }catch(err){
        console.log(err)
    }
}

async function scrollToBottom(tab){
    await tab.evaluate(goToBottom)
    function goToBottom(){
        window.scrollBy(0,window.innerHeight)
    }
}


function getNameAndDuration(videoSelector, durationSelector){
    const videoElem = document.querySelectorAll(videoSelector)
    const durationElem = document.querySelectorAll(durationSelector)

    console.log(videoElem.length,durationElem.length)
    let currentList = []

    for(let i  = 0; i<durationElem.length; i++){
        let videoTitle = videoElem[i].innerText

        let timeStap = (durationElem[i].innerText.split("\n").filter((v)=>v.length!=0)[0]).trim()
        {
            let arr = timeStap.split(":").reverse()
            var duration = 0
            if(arr[2]!==undefined){
                duration = parseInt(arr[2])*60
            }
            if(arr[1]!==undefined){
                duration += parseInt(arr[1])
            }
            if(arr[0]!==undefined){
                if(arr[0]>=30){
                    duration +=1
                }
            }
        }

        currentList.push({"Video Title" : videoTitle, "Duration" : duration})
    }
    
    return currentList
}


async function getStats(tab){
    try{
        const s1 = "#video-title"
        const s2 = "span#text"
        await tab.waitForSelector(s1)
        await tab.waitForSelector(s2)
        const list = await tab.evaluate(getNameAndDuration,s1,s2)
        return list
    }catch(err){
        console.log(err)
    }
} 

function writeExcel(filePath, jsonObj){
    let newWB = xlsx.utils.book_new()
    let newWS = xlsx.utils.json_to_sheet(jsonObj)



    xlsx.utils.book_append_sheet(newWB,newWS,"sheet-1")
    xlsx.writeFile(newWB,filePath)
}